# 調合システム設計書

| 項目 | 内容 |
|------|------|
| 機能名 | 調合システム（Blend System） |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |
| 関連設計書 | [テーマ軸レイヤーアーキテクチャ](../theme-layer-architecture.md), [フレグランスマップ](./fragrance-map.md), [ハイブリッド調合アーキテクチャ](../hybrid-blend-architecture.md) |

---

## 1. 概要

ユーザーがテーマ（シーン x ムード = 30テーマ）とキーワードを選択し、AIが26種の香料から配合比率を算出するシステム。調合結果にはドーナツチャート、ノート構造グラフ、AIストーリー、フレグランスマップ上のポジション、類似フレグランスTop3が含まれる。

**モード3ハイブリッド型**では、3つの調合モードを提供する:
- **ai_only**: ベースAIルール（`perfumer_id = NULL`）のみで配合
- **styled**: ベースAI配合 + クリエータースタイル補正
- **recipe**: クリエーターのシグネチャーレシピを直接使用

> 詳細は [ハイブリッド調合アーキテクチャ設計書](../hybrid-blend-architecture.md) を参照

---

## 2. 調合リクエストフロー

```
Step 0          Step 1          Step 2           Step 3         Step 4          Step 5
モード選択  →  テーマ選択  →  キーワード選択  →  副軸選択   →  AI配合実行  →  結果表示
(必須)         (必須*)        (必須*)           (任意)         (自動)         (自動)

* recipe モードではテーマ・キーワード選択は不要（レシピに含まれる）
```

### Step 0: モード選択（必須）

調合の入口として3つのモードから選択する。

| モード | コード | 説明 |
|--------|--------|------|
| AIおまかせ | `ai_only` | ベースAIルール（`perfumer_id = NULL`）のみで配合 |
| クリエータースタイルで | `styled` | ベースAI + クリエータースタイル補正を適用 |
| レシピから選ぶ | `recipe` | クリエーターのシグネチャーレシピを直接使用（Step 1〜3 をスキップ） |

> `recipe` モードではレシピ選択画面に遷移し、配合計算は行わない。

### Step 1: テーマ選択（必須 ※ai_only / styled モード）

シーン（L2環境層）とムード（L3印象層）の組み合わせでテーマを決定する。

| 軸 | 選択肢 | 数 |
|----|--------|-----|
| シーン（L2-2） | デート / オフィス / パーティー / リラックス / アウトドア / フォーマル | 6 |
| ムード（L3-1） | 明るい / 落ち着いた / 情熱的 / ミステリアス / 清潔感 | 5 |

**基本テーマ数: 6 x 5 = 30テーマ**

テーマ選択により、対応するキーワード・ルールセットが自動的にフィルタリングされる。

### Step 2: キーワード選択（必須、1個以上）

カテゴリ別にプリセットキーワードを表示し、ユーザーが選択する。

| カテゴリ | プリセット例 | フリー入力 |
|---------|------------|-----------|
| SEASON | 春, 夏, 秋, 冬 | - |
| PLACE | まろやか, さわやか | - |
| MOOD | ナチュラル, 陽気, 優雅, 高級, リラックス, ロマンティック | - |
| FREE | 柑橘系, 花束, ウッディ, スパイシー | 可 |

- 各キーワードに重み（0〜10）を設定可能
- フリー入力キーワードは `FREE` カテゴリで自動登録される
- 使用時に `usageCount` がインクリメントされる

### Step 3: 副軸選択（任意）

テーマの補助パラメータとして、以下の副軸を任意で選択できる。

| 副軸 | レイヤー | 選択肢 | 数 | 入力方式 |
|------|---------|--------|-----|---------|
| 季節 | L2環境層 | 春 / 夏 / 秋 / 冬 | 4 | 複数選択可 |
| 時間帯 | L2環境層 | 朝 / 昼 / 夜 | 3 | 複数選択可 |
| エネルギー | L3印象層 | アクティブ / リラックス / 集中 / 高揚 | 4 | 単一選択 |
| 香りの強さ | L3印象層 | ライト / ミディアム / インテンス | 3 | 単一選択 |

副軸はレシピタグとして付与され、配合計算時のフィルタリングと重み調整に使用される。

### Step 4: AI配合実行

1. 選択キーワードに対応するルール（`keyword_flavor_rules`）を取得
2. **積層型ルール合成**: ベースルール(L0) に CALIBRATION(L1)、SEASONAL(L2)、DATA_DRIVEN(L3)、TREND(L4) の各レイヤーを加算し、有効ウェイトを算出（詳細は [ハイブリッド調合アーキテクチャ §3.7](../hybrid-blend-architecture.md) 参照）
3. ルール重み x ユーザー重みで統合スコアを計算
4. ノートタイプ別に正規化（合計=1.0）
5. ノート比率を乗算して最終配合比率を算出（合計=100%）
6. **ユーザー嗜好プロファイル補正**: `computed_taste_profiles` から `flavorAffinities` と `currentMoodModifier` を取得し、配合に反映（詳細は [ハイブリッド調合アーキテクチャ §10](../hybrid-blend-architecture.md) 参照）
7. AIストーリーを非同期生成

### Step 5: 結果表示

配合結果画面に以下を表示する:
- ドーナツチャート（配合比率）
- ノート構造棒グラフ（TOP / MIDDLE / LAST）
- AIストーリー
- フレグランスマップ上のポジション
- 類似フレグランスTop3

---

## 3. 配合計算ロジック

### 3.1 26種香料マスタ

実装: `packages/db/src/schema/flavors.ts`

| 属性 | 型 | 説明 |
|------|-----|------|
| id | UUID | 香料ID |
| nameJa | VARCHAR(100) | 日本語名 |
| nameEn | VARCHAR(100) | 英語名 |
| noteType | `'TOP' \| 'MIDDLE' \| 'LAST'` | ノートタイプ |
| description | TEXT | 説明文 |
| sortOrder | INT | 表示順 |

**26種一覧:**

| ノート | 香料（8-10種） |
|--------|------------|
| TOP (8) | ライム, グレープフルーツ, レモン, オレンジ, ベルガモット, シーブルー, アッサムティ, カシス |
| MIDDLE (10) | ラベンダー, ダフネ, ミュゲ, マグノリア, ガーデニア, チュベローズ, ジャスミン, カーネーション, スウィートローズ, ダマスククラシックローズ |
| LAST (8) | ブラックペッパー, パチュリ, シダーウッド, サンダルウッド, レザー, アンバー, ムスク, バニラ |

### 3.2 キーワード → 香料マッピング（ルールテーブル）

実装: `packages/db/src/schema/rules.ts`

```
keyword_flavor_rules
├── keywordId    → keywords.id
├── flavorId     → flavors.id
├── weight       → DECIMAL(5,4)  関連度 0.0〜1.0
├── noteType     → TOP / MIDDLE / LAST
└── perfumerId   → users.id （作成した調香師）/ NULL（ベースAIルール）
```

**ベースAIルール（`perfumer_id = NULL`）:**
- プラットフォーム管理者が定義する全ユーザー共通のルール
- 30テーマ分を完全網羅し、コールドスタート問題を解消
- `ai_only` モード、`styled` モードの計算基盤

**クリエーター個別ルール（`perfumer_id = UUID`）:**
- 従来のクリエーター定義ルール（段階的にスタイルプロファイルへ移行）

### 3.3 スタイル補正計算（styled モード）

`styled` モードでは、ベースAI配合結果にクリエータースタイルプロファイルの補正を適用する。

**Step 1: ノートバランス補正**

```
補正後ノート比率[note] = 元ノート比率[note] + style.noteBalance[note]Bias
※ 補正後に再正規化（TOP + MIDDLE + LAST = 100%）
```

**Step 2: 香料プリファレンス補正**

```
補正後weight[flavor] = 元weight[flavor] × (1 + style.flavorPreferences[flavor].bias)
※ 各ノート内で再正規化（合計 = 1.0）
```

**Step 3: 最終配合比率算出**

```
finalRatio[flavor] = 補正後normalizedWeights[flavor] × (補正後noteRatio / 100) × 100
```

> スタイルプロファイルの詳細は [ハイブリッド調合アーキテクチャ設計書](../hybrid-blend-architecture.md) を参照

### 3.4 加重平均計算（Decimal.js）

実装: `apps/web/lib/blend-calculator.ts`

Decimal.js設定:
```typescript
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });
```

**アルゴリズム:**

```
Step 1: 加重スコアの蓄積
  noteFlavorWeights[noteType][flavorId] = Σ(rule.weight x keyword.weight)

Step 2: ノートタイプ別正規化
  totalWeight = Σ(noteFlavorWeights[noteType])
  // ガード: totalWeight === 0 の場合（該当ノートにルールが無い等）は
  // 正規化をスキップし、そのノートの配合は空として扱う（ゼロ除算を回避）
  if totalWeight === 0 → normalizedWeights は空（配合対象なし）
  else → normalizedWeights[noteType] = noteFlavorWeights[noteType] / totalWeight
  ※ 各ノート内で合計 = 1.0 になるよう正規化

Step 3: 最終配合比率の算出
  finalRatio = normalizedWeights[flavorId] x (noteRatio / 100) x 100
```

**計算例:**

```
入力:
  キーワード「夏」(weight=7)
  ルール: ライム(TOP) weight=0.8, ベルガモット(TOP) weight=0.6
  ノート比率: TOP=35%, MIDDLE=55%, LAST=10%

Step 1: 加重スコア
  ライム: 0.8 x 7 = 5.6
  ベルガモット: 0.6 x 7 = 4.2

Step 2: 正規化
  ライム: 5.6 / (5.6 + 4.2) = 0.5714
  ベルガモット: 4.2 / (5.6 + 4.2) = 0.4286

Step 3: 最終比率
  ライム: 0.5714 x 0.35 x 100 = 20.00%
  ベルガモット: 0.4286 x 0.35 x 100 = 15.00%
```

### 3.5 ノート正規化

目標比率: **TOP : MIDDLE : LAST = 35 : 55 : 10**（デフォルト）

ユーザーがカスタマイズ可能:
- TOP: 30〜40%
- MIDDLE: 50〜60%
- LAST: 10〜15%
- 合計: 必ず100%

### 3.6 配合比率合計=100%制約

```typescript
const blendInputSchema = z.object({
  topRatio: z.number().min(0).max(100),
  middleRatio: z.number().min(0).max(100),
  lastRatio: z.number().min(0).max(100),
  keywords: z.array(z.object({
    word: z.string().min(1),
    weight: z.number().min(0).max(10),
  })).min(1),
}).refine(d => d.topRatio + d.middleRatio + d.lastRatio === 100, {
  message: '比率の合計は100%にしてください',
});
```

---

## 4. 調合結果表示

### 4.1 ドーナツチャート（配合比率）

実装: `apps/web/components/flavor-chart.tsx`

| 項目 | 仕様 |
|------|------|
| ライブラリ | Recharts PieChart |
| 形状 | ドーナツ（innerRadius=50, outerRadius=90） |
| 色分け | ノートタイプ別カラーパレット |
| ツールチップ | 香料名 + 比率（小数第2位） |

**ノートタイプ別カラーパレット:**

| ノート | 基調色 | カラーコード例 |
|--------|-------|-------------|
| TOP | アンバー系 | `#F59E0B`, `#FBBF24`, `#F97316` ... |
| MIDDLE | ピンク系 | `#EC4899`, `#A855F7`, `#F472B6` ... |
| LAST | グリーン系 | `#059669`, `#0D9488`, `#10B981` ... |

### 4.2 ノート構造（TOP / MIDDLE / LAST 棒グラフ）

各ノートタイプの合計比率を棒グラフで可視化する。
ユーザーが設定したノート比率（例: TOP 35%, MIDDLE 55%, LAST 10%）の構造が視覚的にわかる。

### 4.3 AIストーリー生成

実装: `apps/web/lib/ai-client.ts`

| パラメータ | 値 |
|-----------|-----|
| model | claude-sonnet-4.5（[AIプロバイダー戦略 §11](../hybrid-blend-architecture.md) に基づき環境変数で切替可能） |
| system prompt | "あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。" |
| maxTokens | 500 |
| temperature | 0.8 |

**プロンプト構成:**

```
入力:
  - ユーザーが選択したキーワード一覧
  - 配合結果（香料名 + 比率 + ノートタイプ）
  - ノート比率（TOP / MIDDLE / LAST）

出力:
  - 100〜200字程度の香りのストーリー
  - テーマに沿った情景描写
  - L4世界観層の要素を盛り込む
```

**フォールバック:** AI API失敗時はフォールバックモデル → テンプレートベースの3段階フォールバック（[§11.3](../hybrid-blend-architecture.md) 参照）

### 4.4 フレグランスマップ上のポジション

配合結果から2次元座標を算出し、フレグランスマップに表示する。
詳細は [フレグランスマップ設計書](./fragrance-map.md) を参照。

### 4.5 類似フレグランスTop3

26次元の配合ベクトルからコサイン類似度を計算し、リファレンスフレグランス25種から最も近い3種を表示する。
詳細は [フレグランスマップ設計書](./fragrance-map.md) を参照。

---

## 5. DBスキーマ

### 5.1 ER図

```
flavors (26種)
   ↑
   │ FK
keyword_flavor_rules ──→ keywords
   ↑ FK                    ↑ FK
   │                       │
users (CREATOR)     blend_request_keywords
                           │ FK
                    blend_requests ──→ users (CUSTOMER)
                           │ 1:1
                    blend_results
                           │ 1:N
                    blend_result_flavors ──→ flavors
```

### 5.2 テーブル定義

#### blend_requests（調合リクエスト）

実装: `packages/db/src/schema/blends.ts`

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | リクエストID |
| user_id | UUID | FK → users, NOT NULL | 作成ユーザー |
| top_ratio | DECIMAL(5,2) | NOT NULL | TOPノート比率 (%) |
| middle_ratio | DECIMAL(5,2) | NOT NULL | MIDDLEノート比率 (%) |
| last_ratio | DECIMAL(5,2) | NOT NULL | LASTノート比率 (%) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'PENDING' | PENDING / PROCESSING / COMPLETED / FAILED |
| manual_blend | BOOLEAN | NOT NULL, DEFAULT FALSE | 手動選択フラグ |
| name | VARCHAR(100) | NULLABLE | フレグランス名（ユーザーが命名） |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |

インデックス: `idx_blend_requests_user` ON (user_id)

#### blend_request_keywords（リクエスト内キーワード）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| blend_request_id | UUID | FK → blend_requests (CASCADE) | |
| keyword_id | UUID | FK → keywords | |
| weight | DECIMAL(3,0) | NOT NULL | 重要度 (0〜10) |

インデックス: `idx_blend_request_keywords_request` ON (blend_request_id)

#### blend_request_flavors（リクエスト内手動香料選択）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| blend_request_id | UUID | FK → blend_requests (CASCADE) | |
| flavor_id | UUID | FK → flavors | |
| ratio | DECIMAL(5,2) | NOT NULL | ノート内比率 (%) |
| note_type | VARCHAR(10) | NOT NULL | TOP / MIDDLE / LAST |

インデックス: `idx_blend_request_flavors_request` ON (blend_request_id)

#### blend_results（調合結果）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| blend_request_id | UUID | FK → blend_requests (UNIQUE, CASCADE) | |
| story | TEXT | NULLABLE | AIストーリー |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

#### blend_result_flavors（結果内香料配合）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | |
| blend_result_id | UUID | FK → blend_results (CASCADE) | |
| flavor_id | UUID | FK → flavors | |
| ratio | DECIMAL(5,2) | NOT NULL | 最終配合比率 (%) |
| note_type | VARCHAR(10) | NOT NULL | TOP / MIDDLE / LAST |

インデックス: `idx_blend_result_flavors_result` ON (blend_result_id)

#### flavors（香料マスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 香料ID |
| name_ja | VARCHAR(100) | NOT NULL | 日本語名 |
| name_en | VARCHAR(100) | NOT NULL | 英語名 |
| note_type | VARCHAR(10) | NOT NULL | TOP / MIDDLE / LAST |
| description | TEXT | NULLABLE | 説明文 |
| sort_order | INT | DEFAULT 0 | 表示順 |

#### keywords（キーワード）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | キーワードID |
| word | VARCHAR(100) | NOT NULL | キーワード文字列 |
| category | VARCHAR(20) | NOT NULL | SEASON / PLACE / MOOD / FREE |
| is_preset | BOOLEAN | DEFAULT FALSE | プリセットフラグ |
| usage_count | INT | DEFAULT 0 | 使用回数 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

#### keyword_flavor_rules（ルール）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | ルールID |
| keyword_id | UUID | FK → keywords | 対象キーワード |
| flavor_id | UUID | FK → flavors | 対象香料 |
| weight | DECIMAL(5,4) | NOT NULL | 関連度 (0.0〜1.0) |
| note_type | VARCHAR(10) | NOT NULL | TOP / MIDDLE / LAST |
| perfumer_id | UUID | FK → users | 作成した調香師 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

## 6. Server Actions / API

### 6.1 調合リクエスト

#### createBlend（Server Action）

実装: `apps/web/actions/blend.ts`

```typescript
export async function createBlend(
  _prevState: BlendState,
  formData: FormData,
): Promise<BlendState>
```

| 項目 | 内容 |
|------|------|
| 認証 | 必須（session取得、未認証時 `/login` リダイレクト） |
| 入力 | FormData内JSON (`data` フィールド) → `blendInputSchema` でバリデーション |
| 処理 | `executeBlend()` を呼び出し |
| 出力 | 成功時 `redirect('/result/{blendRequestId}')` / 失敗時 `{ error: string }` |

#### executeBlend（Service Layer）

実装: `apps/web/lib/services/blend-service.ts`

```typescript
export async function executeBlend(params: {
  userId: string;
  mode: 'ai_only' | 'styled' | 'recipe';  // 調合モード
  creatorId?: string;                       // styled モード時に必須
  recipeId?: string;                        // recipe モード時に必須
  keywords?: { word: string; weight: number }[];  // ai_only / styled モード時に必須
  topRatio?: number;                        // ai_only / styled モード時
  middleRatio?: number;                     // ai_only / styled モード時
  lastRatio?: number;                       // ai_only / styled モード時
}): Promise<ExecuteBlendResult>
```

**処理フロー（ai_only / styled モード）:**

```
1. キーワードの検索/作成
   └─ 存在しないキーワードは FREE カテゴリで自動作成
   └─ usageCount をインクリメント

2. blend_requests 作成（status: PROCESSING, mode: ai_only|styled）

3. blend_request_keywords 保存

4. keyword_flavor_rules からベースルール取得
   └─ perfumer_id IS NULL でフィルタ（ベースAIルール）
   └─ 選択キーワードIDで IN 検索
   └─ キーワードID別にグルーピング

5. calculateAutoBlendGrouped() で配合計算

6. (styled モードのみ) applyCreatorStyle() でスタイル補正適用
   └─ creator_profiles からスタイルプロファイル取得
   └─ ノートバランス補正 → 香料プリファレンス補正 → 再正規化

7. blend_results + blend_result_flavors 保存

8. generateStory() でAIストーリー生成
   └─ styled モード: クリエーターの stylePrompt を追加コンテキストとして注入
   └─ 結果を blend_results.story に更新

9. blend_requests.status を COMPLETED に更新
```

**処理フロー（recipe モード）:**

```
1. signature_recipes + signature_recipe_flavors からレシピ取得

2. blend_requests 作成（status: PROCESSING, mode: recipe, recipe_id: 指定ID）

3. レシピの配合をそのまま blend_results + blend_result_flavors に保存

4. generateStory() でAIストーリー生成
   └─ レシピのコンセプト + クリエーターの stylePrompt をコンテキストとして注入

5. blend_requests.status を COMPLETED に更新

6. recipe_stats.sales_count をインクリメント
```

### 6.2 フレグランス名更新

#### updateBlendName（Server Action）

実装: `apps/web/actions/blend.ts`

```typescript
export async function updateBlendName(formData: FormData): Promise<void>
```

| 項目 | 内容 |
|------|------|
| 認証 | 必須 |
| 入力 | `id` (UUID), `name` (1〜100文字) |
| 処理 | 所有権検証 → name更新 → `revalidatePath` |
| 権限 | userId一致チェック |

### 6.3 AI呼び出し

#### ストーリー生成

```typescript
generateStory(keywords, flavors, ratios): Promise<string>
```

- Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) — claude-sonnet-4.5
- フォールバック: gpt-4o → テンプレートベースの代替ストーリー
- 詳細は [ハイブリッド調合アーキテクチャ §11](../hybrid-blend-architecture.md) 参照

#### ルール提案

```typescript
suggestRules(keyword, flavors): Promise<SuggestedRule[]>
```

- 調香師がキーワードのルール定義時にAI提案を受ける機能
- claude-sonnet-4.5 (temperature=0.5) で提案
- フォールバック: gpt-4o-mini → 各ノートから先頭2種を weight=0.5 で返却

---

## 7. コンポーネント一覧

| コンポーネント | 実装パス | 種別 | 説明 |
|--------------|---------|------|------|
| BlendForm | `apps/web/app/(customer)/blend/blend-form.tsx` | Client | 調合リクエストフォーム |
| KeywordInput | `apps/web/components/keyword-input.tsx` | Client | キーワード選択UI |
| NoteRatioSlider | `apps/web/components/note-ratio-slider.tsx` | Client | ノート比率スライダー |
| FlavorChart | `apps/web/components/flavor-chart.tsx` | Client | ドーナツチャート（Recharts PieChart） |
| StoryDisplay | `apps/web/components/story-display.tsx` | Client | AIストーリー表示 |
| FragranceMap | `apps/web/components/fragrance-map.tsx` | Client | フレグランスマップ（Recharts ScatterChart） |
| SimilarFragrances | `apps/web/components/similar-fragrances.tsx` | Client | 類似フレグランスカード |

---

## 8. エラーハンドリング

| エラー | 処理 |
|--------|------|
| Zodバリデーションエラー | `BlendState.error` でフォームにメッセージ表示 |
| 認証エラー | `/login` にリダイレクト |
| ルール未定義（キーワードにルールがない） | 空の配合結果を返却 + 警告表示 |
| AI生成エラー | primary → fallback → テンプレートの3段階フォールバック |
| DB制約違反 | エラーメッセージを返却 |

---

## 9. トランザクション設計（FM-031, RPN=392 / FM-032, RPN=280）

### 9.1 executeBlend() トランザクション境界

`executeBlend()` の処理ステップをトランザクションで保護し、中間状態でのデータ不整合を防止する。

```typescript
async function executeBlend(
  userId: string,
  input: BlendRequestInput,
): Promise<BlendResult> {
  // トランザクション内で実行する処理
  const result = await db.transaction(async (tx) => {
    // 1. blend_requests 作成（status: PROCESSING）
    const [request] = await tx.insert(blendRequests).values({
      userId,
      mode: input.mode,
      status: 'PROCESSING',
    }).returning();

    // 2. blend_request_keywords 紐付
    await tx.insert(blendRequestKeywords).values(
      input.keywordIds.map(keywordId => ({
        blendRequestId: request.id,
        keywordId,
        weight: input.weights?.[keywordId] ?? 1.0,
      }))
    );

    // 3. 配合計算（blend-calculator）
    const calculation = await calculateBlend(tx, input);

    // 4. blend_results 保存
    const [blendResult] = await tx.insert(blendResults).values({
      blendRequestId: request.id,
      totalRatio: calculation.totalRatio,
    }).returning();

    // 5. blend_result_flavors 保存
    await tx.insert(blendResultFlavors).values(
      calculation.flavors.map(f => ({
        blendResultId: blendResult.id,
        flavorId: f.flavorId,
        ratio: f.ratio,
        note: f.note,
      }))
    );

    // 6. ステータス更新
    await tx.update(blendRequests)
      .set({ status: 'COMPLETED' })
      .where(eq(blendRequests.id, request.id));

    return { request, blendResult, calculation };
  });

  // トランザクション外: AIストーリー生成（失敗しても結果は保持）
  try {
    const story = await generateStory(
      result.calculation.keywords,
      result.calculation.flavors,
      result.calculation.ratios,
    );
    await db.update(blendResults)
      .set({ story })
      .where(eq(blendResults.id, result.blendResult.id));
  } catch (error) {
    console.error('[Story Generation Failed]', error);
    Sentry.captureException(error);
    // ストーリー生成失敗は致命的ではない — 結果は保持される
  }

  return result;
}
```

> **設計判断**: AIストーリー生成をトランザクション外に配置する理由:
> - AI API呼出は外部サービス依存であり、レイテンシが不確定（1-5秒）
> - トランザクション保持時間の最小化により、DB接続プールの枯渇を防止
> - ストーリーは後から再生成可能であり、配合結果自体の整合性が最優先

### 9.2 saveRulesForKeyword() トランザクション境界

キーワードのルール更新は「既存削除→新規挿入」のパターンであり、中間状態でルールが0件になるリスクがある。

```typescript
async function saveRulesForKeyword(
  keywordId: string,
  rules: FlavorRuleInput[],
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. 既存ルール削除
    await tx.delete(keywordFlavorRules)
      .where(eq(keywordFlavorRules.keywordId, keywordId));

    // 2. 新規ルール一括挿入
    if (rules.length > 0) {
      await tx.insert(keywordFlavorRules).values(
        rules.map(rule => ({
          keywordId,
          flavorId: rule.flavorId,
          weight: rule.weight,
          note: rule.note,
        }))
      );
    }
  });
}
```

### 9.3 トランザクション分離レベル

| 処理 | 分離レベル | 理由 |
|------|-----------|------|
| `executeBlend()` | READ COMMITTED（デフォルト） | 同時実行される調合リクエスト間の干渉は低い |
| `saveRulesForKeyword()` | READ COMMITTED（デフォルト） | 管理者操作のため同時更新リスクは低い |

---

## 10. N+1クエリ解消（FM-023, RPN=210）

### 10.1 問題箇所

現行の `calculateBlend()` では、キーワードごとにループ内で `keyword_flavor_rules` を取得しており、N+1クエリが発生する。

**問題コード（概念）:**
```typescript
// N+1: キーワード数 × 1クエリ
for (const keyword of keywords) {
  const rules = await db.query.keywordFlavorRules.findMany({
    where: eq(keywordFlavorRules.keywordId, keyword.id),
  });
  // ... 計算
}
```

### 10.2 解消方法: バッチクエリ + JSグルーピング

```typescript
async function calculateBlend(
  tx: Transaction,
  input: BlendRequestInput,
): Promise<BlendCalculation> {
  const keywordIds = input.keywordIds;

  // 1. 全キーワードのルールを一括取得（1クエリ）
  const allRules = await tx.query.keywordFlavorRules.findMany({
    where: inArray(keywordFlavorRules.keywordId, keywordIds),
    with: {
      flavor: true, // JOINで香料情報も取得
    },
  });

  // 2. JSでキーワード別にグルーピング
  const rulesByKeyword = new Map<string, typeof allRules>();
  for (const rule of allRules) {
    const existing = rulesByKeyword.get(rule.keywordId) ?? [];
    existing.push(rule);
    rulesByKeyword.set(rule.keywordId, existing);
  }

  // 3. グルーピング済みデータで計算
  for (const keywordId of keywordIds) {
    const rules = rulesByKeyword.get(keywordId) ?? [];
    // ... 加重平均計算（Decimal.js）
  }

  return calculation;
}
```

### 10.3 クエリ数比較

| パターン | キーワード数=5 | キーワード数=10 |
|---------|--------------|----------------|
| 修正前（N+1） | 6クエリ（1 + 5） | 11クエリ（1 + 10） |
| 修正後（バッチ） | 2クエリ（keywords + rules） | 2クエリ（keywords + rules） |

---

## 11. AI APIリトライ・タイムアウト設計（FM-035, RPN=210）

### 11.1 課題

`executeBlend()` 内の AI API 呼び出し（ストーリー生成）にリトライ・タイムアウト制御がなく、AI サービス障害時に無限待ちやエラーが発生する。

### 11.2 タイムアウト設計

```typescript
// lib/ai/ai-client.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const AI_TIMEOUT_MS = 30_000; // 30秒
const AI_MAX_RETRIES = 3;
const AI_RETRY_BASE_DELAY_MS = 1_000; // 1秒（指数バックオフ）

export async function generateWithRetry(
  prompt: string,
  options?: { maxRetries?: number; timeoutMs?: number }
) {
  const maxRetries = options?.maxRetries ?? AI_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? AI_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const result = await generateText({
        model: openai(env.AI_MODEL ?? 'gpt-4'),
        prompt,
        abortSignal: controller.signal,
      });

      clearTimeout(timeout);
      return result.text;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // リトライ対象: タイムアウト、5xx、レート制限(429)
      if (!isRetryableError(error)) throw error;

      const delay = AI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && 'status' in error) {
    const status = (error as any).status;
    return status === 429 || (status >= 500 && status < 600);
  }
  return false;
}
```

### 11.3 blend-service.ts への適用

```typescript
// blend-service.ts（ストーリー生成部分）
import { generateWithRetry } from '@/lib/ai/ai-client';

// トランザクション外で呼び出し（失敗しても調合結果は保持）
try {
  const story = await generateWithRetry(buildStoryPrompt(blendResult));
  await db.update(blendRequests)
    .set({ story })
    .where(eq(blendRequests.id, requestId));
} catch (error) {
  console.error('[blend] AI story generation failed after retries:', error);
  // story は null のまま — UI側で「ストーリー生成中...」を表示
}
```

### 11.4 リトライポリシー

| パラメータ | 値 | 理由 |
|-----------|-----|------|
| タイムアウト | 30秒 | AI生成は長文応答で10-20秒かかることがある |
| 最大リトライ | 3回 | 一時障害に対応。最大待ち時間は30+1+2+4=37秒 |
| バックオフ | 指数（1s, 2s, 4s） | レート制限時に間隔を空ける |
| リトライ対象 | タイムアウト, 429, 5xx | クライアントエラー(4xx)はリトライ不要 |

---

## 12. Zod バリデーション型整合性（FM-017, RPN=175）

### 12.1 課題

Zodスキーマで `z.number()` (float) を使用しているが、DBカラムは `integer` 型のフィールドがあり、小数値の送信時にDBエラーまたはサイレントな切り捨てが発生する可能性がある。

### 12.2 対象フィールド

| フィールド | Zodスキーマ | DBカラム型 | 修正 |
|-----------|-----------|----------|------|
| `intensity` | `z.number().min(1).max(10)` | `integer` | `z.number().int().min(1).max(10)` |
| `amount` (注文数量) | `z.number().min(1)` | `integer` | `z.number().int().min(1)` |
| `weight` (ルール重み) | `z.number().min(0).max(100)` | `integer` | `z.number().int().min(0).max(100)` |

### 12.3 修正方針

```typescript
// 修正前
const blendRequestSchema = z.object({
  intensity: z.number().min(1).max(10),
  // ...
});

// 修正後 — z.number().int() でinteger制約を追加
const blendRequestSchema = z.object({
  intensity: z.number().int().min(1).max(10),
  // ...
});
```

### 12.4 バリデーションエラーメッセージ

```typescript
intensity: z.number().int({ message: '整数値を入力してください' }).min(1).max(10),
```

小数値が送信された場合、DBに到達する前にZodバリデーションで `"Expected integer, received float"` エラーを返す。

---

## 13. blend_request_flavors テーブル活用設計（FM-021, RPN=140）

### 13.1 課題

`blend_request_flavors` テーブルがスキーマに定義されているが、サービス層・APIルートのいずれからも参照されておらず、デッドスキーマとなっている。

### 13.2 テーブル定義確認

```typescript
// schema/blend.ts
export const blendRequestFlavors = pgTable('blend_request_flavors', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: uuid('request_id').references(() => blendRequests.id),
  flavorNote: varchar('flavor_note', { length: 100 }),
  intensity: integer('intensity'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 13.3 用途定義

このテーブルは調合リクエスト時にユーザーが指定したフレーバーノート（個別の香り希望）を保存する。

| ユースケース | 説明 |
|------------|------|
| 調合リクエストの詳細記録 | キーワード選択に加え、自由入力の香りノート（例:「バニラっぽさを強めに」）を保存 |
| AI プロンプトへの入力 | ストーリー生成時に個別フレーバー希望をコンテキストとして渡す |
| 調合履歴の表示 | ユーザーが過去の調合リクエスト詳細を確認する際に使用 |

### 13.4 サービス層統合設計

```typescript
// blend-service.ts — executeBlend() 内に追加
async function executeBlend(params: BlendParams) {
  return await db.transaction(async (tx) => {
    // Step 1: リクエスト作成
    const [request] = await tx.insert(blendRequests).values({...}).returning();

    // Step 2: キーワード紐付（既存）
    await tx.insert(blendRequestKeywords).values(
      params.keywords.map(k => ({ requestId: request.id, keywordId: k.id }))
    );

    // Step 2.5: フレーバーノート保存（新規追加）
    if (params.flavorNotes?.length) {
      await tx.insert(blendRequestFlavors).values(
        params.flavorNotes.map(fn => ({
          requestId: request.id,
          flavorNote: fn.note,
          intensity: fn.intensity,
        }))
      );
    }

    // Step 3以降: 計算・結果保存...
  });
}
```

### 13.5 API スキーマ追加

```typescript
// Zodスキーマ
const flavorNoteSchema = z.object({
  note: z.string().max(100),
  intensity: z.number().int().min(1).max(10),
});

const blendRequestSchema = z.object({
  keywords: z.array(z.string().uuid()).min(1).max(5),
  flavorNotes: z.array(flavorNoteSchema).max(10).optional(),
  // ...
});
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | FMEA対応: AI APIリトライ設計（§11）、Zodバリデーション型整合性（§12）、blend_request_flavors活用設計（§13）を追加 |
| 2026-02-17 | FMEA対応: トランザクション設計（§9）、N+1クエリ解消（§10）を追加 |
| 2026-02-15 | 初版作成 |
| 2026-02-17 | 整合性修正: セクション3.3重複解消（3.4〜3.6にリナンバリング）、Step 4に積層型ルール合成とユーザー嗜好補正を追加、AIモデルをclaude-sonnet-4.5に統一、Python AI Service参照を削除 |
| 2026-02-14 | モード3ハイブリッド型に移行。モード選択（Step 0）追加、ベースAIルール概念追加、スタイル補正計算追加、executeBlend パラメータ拡張 |

---

*最終更新: 2026年2月14日*
