# クリエーターシステム設計書

> **注意**: 本書の「GPT-4」「OpenAI API」に関する記述は廃止されました。AI機能は claude-sonnet-4.5 を主モデルとするマルチプロバイダー構成に移行しています。最新のAI設計は [ハイブリッド調合アーキテクチャ](./hybrid-blend-architecture.md) を参照してください。

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | クリエーター登録・プロフィール・スタイル/レシピ管理・ダッシュボード・ティア連携 |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

クリエーター（調香師）がプラットフォーム上で活動するための基盤機能を定義する。
登録申請フロー、プロフィール管理、スタイル・レシピ管理、ダッシュボード、統計画面、ティア制度との連携を含む。

> **モード3ハイブリッド型**: ベースAIが常に動作し、クリエーターは「スタイルプロファイル」で調合傾向を定義、「シグネチャーレシピ」として完成品を公開・販売する。詳細は [hybrid-blend-architecture.md](../hybrid-blend-architecture.md) を参照。

---

## 2. クリエーター登録申請フロー

### 2.1 フロー図

```
[ユーザー(CUSTOMER)]
    │
    ▼ 申請フォーム送信
[creator_applications] status=PENDING
    │
    ▼ 管理者が一覧で確認
[管理者] → 審査
    │
    ├─→ 承認: status=APPROVED
    │     ├─ users.role を CREATOR に変更
    │     ├─ creator_profiles レコード作成
    │     ├─ creator_stats レコード作成（初期値）
    │     └─ 承認通知メール送信
    │
    └─→ 却下: status=REJECTED
          └─ 却下理由を記録、却下通知メール送信
```

### 2.2 申請フォーム入力項目

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|-------------|
| display_name | string | Yes | 2〜50文字 |
| creator_id_slug | string | Yes | `^[a-z0-9_]{3,20}$`、ユニーク |
| bio | string | Yes | 10〜1000文字 |
| specialties | string[] | Yes | 1〜5個選択（FLORAL/WOODY/CITRUS/ORIENTAL/FRESH/GOURMAND） |
| portfolio_description | string | No | 最大2000文字（過去の経験や作品の説明） |
| motivation | string | Yes | 50〜500文字（志望動機） |

### 2.3 Zod スキーマ

```typescript
// actions/creator-application.ts

const creatorApplicationSchema = z.object({
  displayName: z.string().min(2).max(50),
  creatorIdSlug: z
    .string()
    .regex(/^[a-z0-9_]{3,20}$/, 'クリエーターIDは半角英数字とアンダースコアのみ（3〜20文字）')
    .refine(async (slug) => {
      const existing = await db.query.creatorProfiles.findFirst({
        where: eq(creatorProfiles.creatorIdSlug, slug),
      });
      return !existing;
    }, 'このIDは既に使用されています'),
  bio: z.string().min(10).max(1000),
  specialties: z.array(z.enum([
    'FLORAL', 'WOODY', 'CITRUS', 'ORIENTAL', 'FRESH', 'GOURMAND',
  ])).min(1).max(5),
  portfolioDescription: z.string().max(2000).optional(),
  motivation: z.string().min(50).max(500),
});
```

### 2.4 Server Action

```typescript
// actions/creator-application.ts

export async function submitCreatorApplication(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: '認証が必要です' };
  if (session.user.role !== 'CUSTOMER') return { error: '既にクリエーターまたは管理者です' };

  // 重複申請チェック
  const existing = await db.query.creatorApplications.findFirst({
    where: and(
      eq(creatorApplications.userId, session.user.id),
      eq(creatorApplications.status, 'PENDING'),
    ),
  });
  if (existing) return { error: '審査中の申請があります' };

  const validated = creatorApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!validated.success) return { error: validated.error.flatten().fieldErrors };

  await db.insert(creatorApplications).values({
    userId: session.user.id,
    ...validated.data,
    status: 'PENDING',
  });

  return { success: '申請を送信しました。審査結果をお待ちください。' };
}
```

### 2.5 管理者承認 Server Action

```typescript
// actions/admin/creator-approval.ts

export async function approveCreatorApplication(applicationId: string): Promise<ActionState> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return { error: '権限がありません' };

  const application = await db.query.creatorApplications.findFirst({
    where: eq(creatorApplications.id, applicationId),
  });
  if (!application || application.status !== 'PENDING') {
    return { error: '対象の申請が見つかりません' };
  }

  await db.transaction(async (tx) => {
    // 1. 申請ステータス更新
    await tx.update(creatorApplications)
      .set({ status: 'APPROVED', reviewedAt: new Date(), reviewedBy: session.user.id })
      .where(eq(creatorApplications.id, applicationId));

    // 2. ユーザーロール変更
    await tx.update(users)
      .set({ role: 'CREATOR' })
      .where(eq(users.id, application.userId));

    // 3. プロフィール作成
    await tx.insert(creatorProfiles).values({
      userId: application.userId,
      displayName: application.displayName,
      creatorIdSlug: application.creatorIdSlug,
      bio: application.bio,
      specialties: application.specialties,
      isActive: true,
      approvedAt: new Date(),
    });

    // 4. 統計レコード作成
    await tx.insert(creatorStats).values({
      userId: application.userId,
      tier: 'APPRENTICE',
      tierScore: '0.00',
    });
  });

  // 5. 承認通知メール送信（非同期）
  await sendCreatorApprovalEmail(application.userId);

  revalidatePath('/admin/creators');
  return { success: '承認しました' };
}
```

---

## 3. プロフィール

### 3.1 プロフィール項目

| フィールド | 表示名 | 型 | 必須 | 説明 |
|-----------|-------|-----|------|------|
| display_name | 表示名 | string | Yes | クリエーター名（2〜50文字） |
| creator_id_slug | クリエーターID | string | Yes | `@xxx` 形式の一意識別子 |
| bio | 自己紹介 | string | Yes | 自由記述（10〜1000文字） |
| avatar_url | アバター画像 | string | No | アップロード画像のURL |
| specialties | 専門分野 | string[] | Yes | 得意な香調カテゴリ（1〜5個） |
| style_description | 調合スタイル | string | No | ユーザー向けスタイル説明 |
| style_prompt | AIプロンプト | string | No | AI提案時の追加コンテキスト（内部用） |
| website_url | Webサイト | string | No | 外部リンク |
| social_links | SNSリンク | jsonb | No | `{ twitter?: string, instagram?: string }` |

### 3.2 公開プロフィール表示

```
┌──────────────────────────────────────────────────┐
│  ┌────────┐                                      │
│  │ Avatar │  田中花子  @tanaka_hanako             │
│  │        │  ◆ Master ──── ティアバッジ           │
│  └────────┘  ✓ 認証済みクリエーター               │
│                                                  │
│  専門分野: FLORAL, CITRUS, FRESH                  │
│                                                  │
│  自然素材の調和を重視し、季節の移ろいを             │
│  香りで表現するスタイルです。                       │
│                                                  │
│  ★ 4.5 (128件)  |  ♥ 256  |  調合 312回          │
│                                                  │
│  [♥ お気に入り]  [このクリエーターで調合する]       │
└──────────────────────────────────────────────────┘
```

### 3.3 プロフィール更新 Zod スキーマ

```typescript
const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
  bio: z.string().min(10).max(1000),
  specialties: z.array(z.enum([
    'FLORAL', 'WOODY', 'CITRUS', 'ORIENTAL', 'FRESH', 'GOURMAND',
  ])).min(1).max(5),
  styleDescription: z.string().max(2000).optional(),
  stylePrompt: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  socialLinks: z.object({
    twitter: z.string().max(100).optional(),
    instagram: z.string().max(100).optional(),
  }).optional(),
});
```

---

## 4. スタイル・レシピ管理

### 4.1 スタイルプロファイル

クリエーターは自分の調合傾向を「スタイルプロファイル」として定義する。
`styled` モードでの調合時、ベースAI配合にスタイル補正が適用される。

```typescript
type CreatorStyle = {
  noteBalance: {
    topBias: number;      // -0.3〜+0.3
    middleBias: number;   // -0.3〜+0.3
    lastBias: number;     // -0.3〜+0.3
  };
  flavorPreferences: {
    flavorId: string;
    bias: number;         // -0.5〜+0.5
  }[];
  description: string;    // ユーザー向けスタイル説明
  stylePrompt: string;    // AI向け内部プロンプト
};
```

| パラメータ | 範囲 | 説明 |
|-----------|------|------|
| `noteBalance.*Bias` | -0.3〜+0.3 | ノート比率の補正値。+で強調、-で抑制 |
| `flavorPreferences[].bias` | -0.5〜+0.5 | 特定香料の重み補正。+で強調、-で抑制 |
| `description` | 自由記述 | ユーザーに表示するスタイル説明文 |
| `stylePrompt` | 自由記述 | AIストーリー生成時の追加コンテキスト |

スタイルプロファイルは `creator_profiles` テーブルの `style_note_balance`（jsonb）、`style_flavor_preferences`（jsonb）カラムに格納される。

### 4.2 シグネチャーレシピ CRUD

クリエーターは完成品の配合を「シグネチャーレシピ」として作成・公開・販売できる。

**レシピ作成・更新:**

```typescript
const createRecipeSchema = z.object({
  name: z.string().min(1).max(100),
  concept: z.string().min(10).max(2000),
  scene: z.enum(['デート', 'オフィス', 'パーティー', 'リラックス', 'アウトドア', 'フォーマル']),
  mood: z.enum(['明るい', '落ち着いた', '情熱的', 'ミステリアス', '清潔感']),
  flavors: z.array(z.object({
    flavorId: z.string().uuid(),
    ratio: z.number().min(0).max(100),
    noteType: z.enum(['TOP', 'MIDDLE', 'LAST']),
  })).min(1).refine(
    (flavors) => flavors.reduce((sum, f) => sum + f.ratio, 0) === 100,
    { message: '配合比率の合計は100%にしてください' }
  ),
  price30ml: z.number().int().min(1),
  price50ml: z.number().int().min(1),
});
```

**Server Actions:**

| Action | 説明 | 権限 |
|--------|------|------|
| `createRecipe` | レシピ新規作成（status: DRAFT） | CREATOR |
| `updateRecipe` | レシピ更新（DRAFT 状態のみ） | CREATOR（自分のレシピ） |
| `publishRecipe` | レシピ公開（DRAFT → PUBLISHED） | CREATOR（自分のレシピ） |
| `unpublishRecipe` | レシピ非公開化（PUBLISHED → DRAFT） | CREATOR（自分のレシピ） |
| `deleteRecipe` | レシピ削除 | CREATOR（自分のレシピ） / ADMIN |

### 4.3 レシピ管理指標

クリエーターダッシュボードに以下のレシピ指標を表示する。

```typescript
type RecipeManagementStats = {
  totalRecipes: number;        // 総レシピ数
  publishedRecipes: number;    // 公開中レシピ数
  draftRecipes: number;        // 下書きレシピ数
  totalSalesCount: number;     // 全レシピの累計販売数
  totalRevenue: number;        // 全レシピの累計売上
  topRecipes: {
    recipeId: string;
    name: string;
    salesCount: number;
    avgRating: number;
    revenue: number;
  }[];
};
```

### 4.4 レシピ作成時のAIアシスト

クリエーターがレシピを作成する際、テーマ（シーン x ムード）とコンセプトを入力すると、AIが配合を提案する。

```typescript
// actions/creator-recipes.ts

export async function suggestRecipe(params: {
  scene: string;
  mood: string;
  concept: string;
}): Promise<RecipeSuggestion> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('認証が必要です');

  const allFlavors = await db.select().from(flavors).orderBy(flavors.sortOrder);

  // クリエーターのスタイルプロファイルを取得
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, session.user.id),
  });

  const prompt = buildRecipeSuggestionPrompt({
    scene: params.scene,
    mood: params.mood,
    concept: params.concept,
    flavors: allFlavors,
    stylePrompt: profile?.stylePrompt,
    styleNoteBalance: profile?.styleNoteBalance,
    styleFlavorPreferences: profile?.styleFlavorPreferences,
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: RECIPE_SUGGESTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return parseRecipeSuggestion(response, allFlavors);
  } catch {
    return generateFallbackRecipeSuggestion(allFlavors, params);
  }
}
```

### 4.5 一括レシピ提案

未カバーのテーマに対して一括でAIレシピ提案を実行する。

```typescript
export async function bulkSuggestRecipes(): Promise<BulkSuggestionResult> {
  const session = await auth();

  // クリエーターがまだカバーしていないテーマを取得
  const uncoveredThemes = await getUncoveredThemes(session.user.id);

  const results: BulkSuggestionResult = { suggestions: [], failed: 0, errors: [] };

  for (const theme of uncoveredThemes) {
    try {
      const suggestion = await suggestRecipe({
        scene: theme.scene,
        mood: theme.mood,
        concept: `${theme.scene}での${theme.mood}な香り`,
      });
      results.suggestions.push({
        scene: theme.scene,
        mood: theme.mood,
        ...suggestion,
      });
    } catch (error) {
      results.failed++;
      results.errors.push({ theme, error: String(error) });
    }
  }

  return results;
  // 注: 提案のみで自動保存はしない。クリエーターが確認・編集後に保存する。
}
```

### 4.6 レシピバージョニング

レシピ編集時の既存注文との整合性を保つためのバージョン管理ルール。

| 項目 | ルール |
|------|--------|
| バージョン番号 | `signature_recipes.version` を編集毎に +1 |
| 既存注文への影響 | 注文確定時に `recipe_version_snapshot` を `order_items` に保存。過去の注文は元の配合を維持 |
| 配合変更 | `recipe_flavors` を全削除→再挿入。旧配合は注文の `blend_result_flavors` に保存済み |
| 公開中レシピの編集 | 即時反映（新規注文から新バージョン適用）。重大変更時はクリエーターに確認ダイアログ表示 |
| レビューの継続性 | バージョン更新後もレビューは継続（バージョンアップでリセットしない） |

---

## 5. クリエーターダッシュボード

### 5.1 ダッシュボード項目

```
┌──────────────────────────────────────────────────┐
│  クリエーターダッシュボード                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 売上 │ │ 注文 │ │リピート│ │ 評価 │ │カバー│  │
│  │¥128K │ │ 45件 │ │ 32%  │ │★4.5 │ │ 92% │  │
│  │+12%  │ │+8件  │ │+5%   │ │+0.2 │ │     │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                                  │
│  ティア進捗                                       │
│  ◆ Master (スコア: 78.5)                          │
│  ━━━━━━━━━━━━━━░░░░░ Grand Master まで 76%      │
│                                                  │
│  足切り条件チェック:                                │
│  ✓ レシピ売上数 312/500  ✓ レシピレビュー数 128/150 │
│  ✓ 平均評価 4.5/4.5                               │
│                                                  │
│  最近のレビュー                                    │
│  ★★★★★ とても素敵な香りでした... (2日前)            │
│  ★★★★☆ 期待通りのウッディな... (5日前)             │
│                                                  │
│  人気レシピ TOP 3                                  │
│  1. 夏の風 (注文32回)                              │
│  2. 春の花束 (注文28回)                             │
│  3. 森のささやき (注文21回)                          │
└──────────────────────────────────────────────────┘
```

### 5.2 ダッシュボードデータ型

```typescript
type CreatorDashboard = {
  // KPI
  monthlySales: number;           // 今月の売上
  monthlySalesChange: number;     // 前月比（%）
  monthlyOrders: number;          // 今月の注文数
  monthlyOrdersChange: number;    // 前月比
  repeatRate: number;             // リピート率（%）
  repeatRateChange: number;       // 前月比
  avgRating: number;              // 平均評価
  avgRatingChange: number;        // 前月比
  themeCoveragePercent: number;    // テーマカバレッジ率（30テーマ中のレシピ公開数）

  // ティア
  tier: CreatorTier;
  tierScore: number;
  nextTier: CreatorTier | null;
  tierProgress: number;           // 次ティアへの進捗（%）
  thresholdChecks: {
    recipeSalesCount: { current: number; required: number; met: boolean };
    recipeReviewCount: { current: number; required: number; met: boolean };
    avgRating: { current: number; required: number; met: boolean };
  };

  // 最近のレビュー
  recentReviews: {
    rating: number;
    comment: string;
    createdAt: Date;
    reviewerName: string;
  }[];

  // 人気レシピ
  popularRecipes: {
    name: string;
    orderCount: number;
    avgRating: number;
  }[];
};
```

---

## 6. 統計画面

### 6.1 月別売上グラフ

Recharts の `BarChart` + `LineChart` を組み合わせたコンポジットチャート。

```typescript
type MonthlySalesData = {
  month: string;        // "2026-01"
  sales: number;        // 売上金額
  orderCount: number;   // 注文数
  royalty: number;      // ロイヤリティ金額
};
```

### 6.2 人気レシピランキング

```typescript
type PopularRecipe = {
  rank: number;
  recipeName: string;       // レシピ名
  recipeId: string;
  salesCount: number;        // 販売数
  avgRating: number;
  scene: string;             // シーン
  mood: string;              // ムード
  revenue: number;
};
```

### 6.3 顧客属性分析

```typescript
type CustomerInsights = {
  // リピーター vs 新規
  repeatCustomers: number;
  newCustomers: number;
  repeatRatio: number;

  // 人気キーワード（自分の顧客が選んだキーワード）
  topKeywords: { word: string; count: number }[];

  // 注文時間帯分布
  orderHourDistribution: { hour: number; count: number }[];

  // 平均注文金額の推移
  avgOrderAmountTrend: { month: string; amount: number }[];
};
```

### 6.4 統計画面ワイヤフレーム

```
┌──────────────────────────────────────────────────┐
│  統計  [月別 | 週別 | 日別]   期間: [2026年1月 ▼]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  月別売上推移                                      │
│  ┌────────────────────────────────────────┐      │
│  │  ▓▓                                   │      │
│  │  ▓▓  ▓▓      ▓▓                      │      │
│  │  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓             │      │
│  │  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓    │      │
│  │  10月  11月 12月 1月  2月               │      │
│  └────────────────────────────────────────┘      │
│                                                  │
│  人気レシピ                   顧客属性            │
│  ┌──────────────────┐ ┌────────────────────┐    │
│  │ 1. 夏の風   32注文│ │ リピーター 68%      │    │
│  │ 2. 春の花束 28注文│ │ 新規 32%            │    │
│  │ 3. 森ささやき21注文│ │                    │    │
│  │ 4. 秋の月  18注文│ │ 人気KW: 夏, 優雅    │    │
│  │ 5. 冬の静寂 15注文│ │        リラックス   │    │
│  └──────────────────┘ └────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

## 7. ティア連携

### 7.1 ティア定義

| ティア | コード | 最低スコア | アイコン | カラー |
|--------|--------|-----------|---------|--------|
| T1 | APPRENTICE | 0 | ◇ | #a3a3a3 (gray) |
| T2 | ARTISAN | 30 | ◆ | #cd7f32 (bronze) |
| T3 | EXPERT | 55 | ◆ | #94a3b8 (silver) |
| T4 | MASTER | 75 | ◆ | #d97706 (gold) |
| T5 | GRAND_MASTER | 90 | ◆ | #a78bfa (platinum) |

> 詳細は [creator-tier-system.md](../creator-tier-system.md) を参照

### 7.2 スコア計算

| 指標 | 重み | ソース | 正規化 |
|------|------|--------|--------|
| 平均評価 | 30% | `creator_stats.avg_rating` | `(rating - 1.0) / 4.0 * 100` |
| リピート率 | 25% | `creator_stats.repeat_rate` | そのまま 0〜100 |
| お気に入り数 | 20% | `creator_stats.favorite_count` | `min(ln(count+1) / ln(500) * 100, 100)` |
| レシピ売上数 | 15% | `creator_stats.recipe_sales_count` | `min(ln(count+1) / ln(1000) * 100, 100)` |
| レシピレビュー数 | 10% | `creator_stats.recipe_review_count` | `min(ln(count+1) / ln(300) * 100, 100)` |

### 7.3 足切り条件

| ティア | 最低レシピ売上数 | 最低レシピレビュー数 | 最低評価 |
|--------|----------------|-------------------|---------|
| T2 Artisan | 50 | 10 | 3.5 |
| T3 Expert | 150 | 40 | 4.0 |
| T4 Master | 300 | 80 | 4.3 |
| T5 Grand Master | 500 | 150 | 4.5 |

### 7.4 更新タイミング

| イベント | 処理 |
|---------|------|
| 月次バッチ（毎月1日 03:00） | 全クリエーターのスコア再計算・ティア更新 |
| リアルタイム | `recipe_sales_count`, `favorite_count` 等はイベント発生時に即時更新 |
| 降格保護 | 3ヶ月連続で基準未達の場合のみ降格（`months_below_threshold` カウンター） |

### 7.5 ティアによる特典

| 特典 | APPRENTICE | ARTISAN | EXPERT | MASTER | GRAND_MASTER |
|------|-----------|---------|--------|--------|-------------|
| ロイヤリティ率 | 10% | 12% | 15% | 18% | 20% |
| プロフィール露出 | 通常 | 通常 | 優先 | 最優先 | 最優先 |
| アワード対象 | - | ○ | ○ | ○ | ○ |
| バッジ表示 | ◇ | ◆ ARTISAN | ◆ EXPERT | ◆ MASTER | ◆ GRAND_MASTER |

> **相互参照**: ロイヤリティ率の管理画面での設定変更は [ec-settings.md §2.5](./ec-settings.md) を参照。管理者はデフォルト料率を変更可能。

### 7.6 クリエーター退会処理

退会申請からの処理フロー:

1. **退会申請**: クリエーターが退会リクエストを送信
2. **保留期間**: 30日間の保留期間（取消可能）
3. **未払いロイヤリティ精算**: 保留期間中に全未払いロイヤリティを精算
4. **進行中注文の完了**: 未完了注文がある場合は完了まで退会を保留
5. **退会実行**:
   - `users.role` を `CUSTOMER` に戻す
   - `creator_profiles.is_active` を `false` に設定
   - 公開レシピのステータスを `ARCHIVED` に変更
   - レシピは閲覧可能（注文不可）として残す
   - 既存の注文・レビューデータは保持（匿名化しない）
6. **復帰**: 再申請により APPRENTICE ティアから再スタート可能

| 項目 | 扱い |
|------|------|
| 公開レシピ | ARCHIVED（閲覧可・注文不可） |
| 既存注文 | そのまま保持 |
| レビュー | そのまま保持 |
| ロイヤリティ履歴 | そのまま保持 |
| スタイルプロファイル | 削除 |

---

## 8. DB スキーマ

### 8.1 creator_applications（クリエーター登録申請）

```typescript
// packages/db/src/schema/creator-applications.ts

export const applicationStatusEnum = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof applicationStatusEnum)[number];

export const creatorApplications = pgTable(
  'creator_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 申請者
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 申請内容
    displayName: varchar('display_name', { length: 100 }).notNull(),
    creatorIdSlug: varchar('creator_id_slug', { length: 20 }).notNull(),
    bio: text('bio').notNull(),
    specialties: jsonb('specialties').notNull().$type<string[]>(),
    portfolioDescription: text('portfolio_description'),
    motivation: text('motivation').notNull(),

    // 審査
    status: varchar('status', { length: 20 })
      .notNull()
      .default('PENDING')
      .$type<ApplicationStatus>(),
    rejectionReason: text('rejection_reason'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_creator_applications_user').on(table.userId),
    index('idx_creator_applications_status').on(table.status),
  ],
);
```

### 8.2 creator_profiles（クリエータープロフィール）

```typescript
// packages/db/src/schema/creator-profiles.ts

export const creatorProfiles = pgTable(
  'creator_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // FK: users.id（CREATOR ロールのユーザー）
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    // プロフィール
    displayName: varchar('display_name', { length: 100 }).notNull(),
    creatorIdSlug: varchar('creator_id_slug', { length: 20 }).notNull().unique(),
    bio: text('bio').notNull(),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    specialties: jsonb('specialties').notNull().$type<string[]>(),
    styleDescription: text('style_description'),
    stylePrompt: text('style_prompt'),
    styleNoteBalance: jsonb('style_note_balance')
      .$type<{ topBias: number; middleBias: number; lastBias: number }>(),
    styleFlavorPreferences: jsonb('style_flavor_preferences')
      .$type<{ flavorId: string; bias: number }[]>(),
    websiteUrl: varchar('website_url', { length: 500 }),
    socialLinks: jsonb('social_links').$type<{ twitter?: string; instagram?: string }>(),

    // 状態
    isActive: boolean('is_active').notNull().default(false),
    approvedAt: timestamp('approved_at'),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_creator_profiles_user').on(table.userId),
    index('idx_creator_profiles_slug').on(table.creatorIdSlug),
    index('idx_creator_profiles_active').on(table.isActive),
  ],
);

export const creatorProfilesRelations = relations(creatorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [creatorProfiles.userId],
    references: [users.id],
  }),
}));
```

### 8.3 ER図

```
users (CUSTOMER)
  │
  └── 1:N ── creator_applications
               ├── status (PENDING/APPROVED/REJECTED)
               ├── display_name
               ├── creator_id_slug
               ├── bio
               ├── specialties (jsonb)
               └── motivation

users (CREATOR)
  ├── 1:1 ── creator_profiles
  │            ├── display_name
  │            ├── creator_id_slug (@xxx)
  │            ├── bio, avatar_url
  │            ├── specialties (jsonb)
  │            ├── style_description
  │            ├── style_prompt
  │            ├── style_note_balance (jsonb)          ← ハイブリッド型追加
  │            ├── style_flavor_preferences (jsonb)    ← ハイブリッド型追加
  │            └── is_active
  │
  ├── 1:1 ── creator_stats
  │            ├── recipe_sales_count, favorite_count
  │            ├── recipe_review_count, avg_rating
  │            ├── repeat_rate
  │            ├── tier_score, tier
  │            └── months_below_threshold
  │
  ├── 1:N ── signature_recipes                        ← ハイブリッド型追加
  │            ├── name, concept
  │            ├── scene (L2), mood (L3)
  │            ├── status (DRAFT/PUBLISHED)
  │            ├── price_30ml, price_50ml
  │            ├── 1:N ── signature_recipe_flavors
  │            │            ├── flavor_id → flavors
  │            │            ├── ratio, note_type
  │            └── 1:1 ── recipe_stats
  │                         ├── sales_count, review_count
  │                         ├── avg_rating, favorite_count
  │
  └── 1:N ── recipe_reviews (as recipe の creator)
               ├── reviewer_id → users
               ├── rating (1〜5)
               └── comment
```

---

## 9. 画面一覧

| パス | 画面名 | ロール | 説明 |
|------|--------|--------|------|
| `/creator/apply` | 登録申請 | CUSTOMER | クリエーター登録申請フォーム |
| `/creator/apply/status` | 申請状況 | CUSTOMER | 申請ステータス確認 |
| `/creator/dashboard` | ダッシュボード | CREATOR | KPI・ティア進捗・最近のレビュー・レシピ指標 |
| `/creator/profile` | プロフィール編集 | CREATOR | 自身のプロフィール・スタイルプロファイル編集 |
| `/creator/recipes` | レシピ一覧 | CREATOR | シグネチャーレシピ管理一覧 |
| `/creator/recipes/new` | レシピ作成 | CREATOR | シグネチャーレシピ新規作成 |
| `/creator/recipes/[id]` | レシピ編集 | CREATOR | シグネチャーレシピ編集 |
| `/creator/stats` | 統計 | CREATOR | 月別売上・人気レシピ・顧客属性 |
| `/creator/royalties` | ロイヤリティ | CREATOR | 売上・報酬履歴 |
| `/admin/creators` | クリエーター管理 | ADMIN | 申請承認・一覧・停止 |

---

## 10. creator_profiles / styles サービス層設計（FM-009, RPN=175）

### 10.1 概要

クリエータープロフィールとスタイルプロファイルの操作を `creator-profile-service.ts` に集約し、対応するAPIルートを定義する。

### 10.2 サービス関数設計

```typescript
// services/creator-profile-service.ts

/** プロフィール取得 */
export async function getCreatorProfile(
  userId: string,
): Promise<CreatorProfile | null> {
  return db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
    with: {
      user: {
        columns: { nickname: true, image: true, creatorId: true },
      },
    },
  });
}

/** プロフィール更新 */
export async function updateCreatorProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<CreatorProfile> {
  const [updated] = await db.update(creatorProfiles)
    .set({
      displayName: input.displayName,
      bio: input.bio,
      specialties: input.specialties,
      socialLinks: input.socialLinks,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.userId, userId))
    .returning();
  return updated;
}

/** スタイルプロファイル取得 */
export async function getCreatorStyle(
  userId: string,
): Promise<CreatorStyleProfile | null> {
  return db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
    columns: {
      stylePrompt: true,
      preferredNotes: true,
      signatureIngredients: true,
      philosophyText: true,
    },
  });
}

/** スタイルプロファイル更新 */
export async function updateCreatorStyle(
  userId: string,
  input: UpdateStyleInput,
): Promise<CreatorStyleProfile> {
  const [updated] = await db.update(creatorProfiles)
    .set({
      stylePrompt: input.stylePrompt,
      preferredNotes: input.preferredNotes,
      signatureIngredients: input.signatureIngredients,
      philosophyText: input.philosophyText,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.userId, userId))
    .returning();
  return updated;
}
```

### 10.3 Zod バリデーションスキーマ

```typescript
// lib/validations/creator.ts
import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  specialties: z.array(z.string()).max(10).optional(),
  socialLinks: z.object({
    twitter: z.string().url().optional(),
    instagram: z.string().url().optional(),
    website: z.string().url().optional(),
  }).optional(),
});

export const updateStyleSchema = z.object({
  stylePrompt: z.string().max(1000).optional(),
  preferredNotes: z.array(z.enum(['TOP', 'MIDDLE', 'LAST'])).optional(),
  signatureIngredients: z.array(z.string().uuid()).max(10).optional(),
  philosophyText: z.string().max(2000).optional(),
});
```

### 10.4 APIルート設計

| メソッド | パス | 説明 | 認証 | ロール |
|---------|------|------|------|--------|
| `GET` | `/api/v1/creator/profile` | 自身のプロフィール取得 | 必須 | CREATOR |
| `PUT` | `/api/v1/creator/profile` | プロフィール更新 | 必須 | CREATOR |
| `GET` | `/api/v1/creator/style` | スタイルプロファイル取得 | 必須 | CREATOR |
| `PUT` | `/api/v1/creator/style` | スタイルプロファイル更新 | 必須 | CREATOR |
| `GET` | `/api/v1/creators/:id/profile` | 公開プロフィール取得 | 不要 | 全ユーザー |

### 10.5 APIルート実装例

```typescript
// app/api/v1/creator/profile/route.ts
import { auth } from '@/lib/auth';
import { getCreatorProfile, updateCreatorProfile } from '@/services/creator-profile-service';
import { updateProfileSchema } from '@/lib/validations/creator';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'CREATOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getCreatorProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'CREATOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = updateProfileSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validated.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateCreatorProfile(session.user.id, validated.data);
  return NextResponse.json(updated);
}
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | B-04修正: §7.5 ロイヤリティ率を ec-settings.md と統一（10%/12%/15%/18%/20%）。バッジ表示名を修正。ec-settings.md §2.5 への相互参照を追加 |
| 2026-02-17 | FMEA対応: creator_profiles/styles サービス層設計（§10）を追加 |
| 2026-02-17 | B4-B8 ビジネスルール定義を追加 |
| 2026-02-15 | 初版作成 |
| 2026-02-14 | モード3ハイブリッド型に移行。セクション4「キーワード・ルール管理」→「スタイル・レシピ管理」に変更。スタイルプロファイル、シグネチャーレシピCRUD、レシピ管理指標、AIアシスト、一括レシピ提案を追加。画面一覧をレシピ管理画面に更新 |

---

*最終更新: 2026年2月17日*
