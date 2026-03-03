# ハイブリッド調合アーキテクチャ設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | モード3ハイブリッド型調合アーキテクチャ |
| バージョン | 1.0 |
| 作成日 | 2026-02-14 |

---

## 1. 概要

モード3ハイブリッド型の全体設計。「AIが調合し、クリエーターが味付けする」モデル。

従来の「クリエーター依存型」から脱却し、以下の構造に移行する:

- **ベースAI**（`perfumer_id = NULL` のルール）が常に動作し、全ユーザーが利用可能
- クリエーターは「**スタイルプロファイル**」で自分の調合傾向を定義
- クリエーターは「**シグネチャーレシピ**」として完成品を公開・販売
- ユーザーは **3つの入口** から選択: AIおまかせ / クリエータースタイルで / レシピから選ぶ

**メリット:**

| 課題 | 解決 |
|------|------|
| コールドスタート問題 | ベースAIルールにより、クリエーター不在でも調合可能 |
| クリエーター依存リスク | プラットフォーム管理の30テーマ分ベースルールが基盤 |
| クリエーターの差別化 | スタイル補正とシグネチャーレシピで個性を発揮 |
| 収益モデル | レシピ販売による直接的な収益化が可能 |

---

## 2. アーキテクチャ

3つの調合モードを提供する:

| モード | コード | 説明 | クリエーター必須 |
|--------|--------|------|:---------------:|
| AIおまかせ | `ai_only` | ベースAI配合のみ | - |
| クリエータースタイル | `styled` | ベースAI + クリエータースタイル補正 | Yes |
| レシピから選ぶ | `recipe` | クリエーターのシグネチャーレシピを直接使用 | Yes |

```
┌─────────────────────────────────────────────────────────────┐
│                    ユーザー入口                               │
├──────────────┬────────────────────┬─────────────────────────┤
│  AIおまかせ   │ クリエータースタイルで │  レシピから選ぶ          │
│  (ai_only)   │ (styled)            │  (recipe)              │
├──────────────┼────────────────────┼─────────────────────────┤
│              │                    │                         │
│  テーマ選択   │  テーマ選択          │  レシピ一覧/検索         │
│  キーワード選択│  キーワード選択      │  レシピ詳細             │
│       │      │  クリエーター選択    │       │                │
│       ▼      │       │            │       ▼                │
│  ベースAIルール│       ▼            │  レシピ配合を           │
│  取得・計算   │  ベースAIルール      │  そのまま使用           │
│       │      │  取得・計算          │                        │
│       │      │       │            │                         │
│       │      │  スタイル補正適用    │                         │
│       │      │       │            │                         │
│       ▼      │       ▼            │                         │
│  配合結果     │  配合結果           │  配合結果               │
└──────────────┴────────────────────┴─────────────────────────┘
```

---

## 3. ベースAIルール

### 3.1 概要

`keyword_flavor_rules` テーブルで `perfumer_id = NULL` のレコードがベースAIルールとなる。
プラットフォーム管理者が30テーマ分を一括定義し、全ユーザーが利用可能。

### 3.2 特徴

| 項目 | 内容 |
|------|------|
| 管理者 | プラットフォーム管理者（ADMIN） |
| 対象 | 全16種プリセットキーワード x 26種香料 |
| perfumer_id | `NULL`（特定クリエーターに紐付かない） |
| テーマカバレッジ | 30テーマ（6シーン x 5ムード）を完全網羅 |
| 更新頻度 | 季節ごと or 管理者の判断で随時 |

### 3.3 コールドスタート解消

```
従来（クリエーター依存型）:
  ユーザー → テーマ選択 → クリエーター選択（必須） → ルール取得 → 配合
  問題: クリエーターがルール未定義 → 配合不可

ハイブリッド型:
  ユーザー → テーマ選択 → ベースAIルール取得（常に存在） → 配合
  解決: クリエーター不在でも常に配合可能
```

### 3.4 ベースルール蓄積方法

ベースAIルール（16キーワード × 26香料 = 416ルール）の構築・運用を4フェーズで段階的に実施する。

#### Phase 1: AI一括生成（ローンチ前 — 初期構築）

GPT-4 を使い、全416ルール（weight 0.0〜1.0）を一括生成する。

**生成スクリプト:**

```typescript
// scripts/generate-base-rules.ts

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const PRESET_KEYWORDS = [
  '春', '夏', '秋', '冬',
  'まろやか', 'さわやか', 'ナチュラル',
  '陽気', '優雅', '高級', 'リラックス', 'ロマンティック',
  'セクシー', 'クール', 'フレッシュ', 'ミステリアス',
];

const FLAVORS = [
  // TOP (8)
  { name: 'ライム', nameEn: 'Lime', noteType: 'TOP' },
  { name: 'グレープフルーツ', nameEn: 'Grapefruit', noteType: 'TOP' },
  { name: 'レモン', nameEn: 'Lemon', noteType: 'TOP' },
  { name: 'オレンジ', nameEn: 'Orange', noteType: 'TOP' },
  { name: 'ベルガモット', nameEn: 'Bergamot', noteType: 'TOP' },
  { name: 'シーブルー', nameEn: 'Sea Blue', noteType: 'TOP' },
  { name: 'アッサムティ', nameEn: 'Assam Tea', noteType: 'TOP' },
  { name: 'カシス', nameEn: 'Cassis', noteType: 'TOP' },
  // MIDDLE (10)
  { name: 'ラベンダー', nameEn: 'Lavender', noteType: 'MIDDLE' },
  { name: 'ダフネ', nameEn: 'Daphne', noteType: 'MIDDLE' },
  { name: 'ミュゲ', nameEn: 'Muguet', noteType: 'MIDDLE' },
  { name: 'マグノリア', nameEn: 'Magnolia', noteType: 'MIDDLE' },
  { name: 'ガーデニア', nameEn: 'Gardenia', noteType: 'MIDDLE' },
  { name: 'チュベローズ', nameEn: 'Tuberose', noteType: 'MIDDLE' },
  { name: 'ジャスミン', nameEn: 'Jasmine', noteType: 'MIDDLE' },
  { name: 'カーネーション', nameEn: 'Carnation', noteType: 'MIDDLE' },
  { name: 'スウィートローズ', nameEn: 'Sweet Rose', noteType: 'MIDDLE' },
  { name: 'ダマスククラシックローズ', nameEn: 'Damascus Classic Rose', noteType: 'MIDDLE' },
  // LAST (8)
  { name: 'ブラックペッパー', nameEn: 'Black Pepper', noteType: 'LAST' },
  { name: 'パチュリ', nameEn: 'Patchouli', noteType: 'LAST' },
  { name: 'シダーウッド', nameEn: 'Cedarwood', noteType: 'LAST' },
  { name: 'サンダルウッド', nameEn: 'Sandalwood', noteType: 'LAST' },
  { name: 'レザー', nameEn: 'Leather', noteType: 'LAST' },
  { name: 'アンバー', nameEn: 'Amber', noteType: 'LAST' },
  { name: 'ムスク', nameEn: 'Musk', noteType: 'LAST' },
  { name: 'バニラ', nameEn: 'Vanilla', noteType: 'LAST' },
];

const ruleSchema = z.object({
  rules: z.array(z.object({
    keyword: z.string(),
    flavorNameEn: z.string(),
    noteType: z.enum(['TOP', 'MIDDLE', 'LAST']),
    weight: z.number().min(0).max(1).step(0.05),
    reasoning: z.string(),
  })),
});

/**
 * キーワード1つにつき26香料分のルールを生成
 * API呼び出し回数を抑えるため、キーワード単位でバッチ
 */
async function generateRulesForKeyword(keyword: string) {
  const flavorListStr = FLAVORS
    .map(f => `${f.nameEn} (${f.name}, ${f.noteType})`)
    .join('\n');

  const { object } = await generateObject({
    model: openai('gpt-4'),
    schema: ruleSchema,
    system: `あなたはプロの調香師です。
キーワードに対する各香料の「関連度（weight）」を0.00〜1.00で判定してください。

判定基準:
- 1.0: そのキーワードを聞いて真っ先に連想する香り
- 0.7〜0.9: 強い関連性がある
- 0.4〜0.6: 中程度の関連性
- 0.1〜0.3: 弱い関連性
- 0.0: 関連なし（配合に使わない）

注意:
- 各ノートタイプ（TOP/MIDDLE/LAST）からバランス良く選定
- 0.0のルールも含めて全26香料分を出力
- weightは0.05刻み
- reasoning に1行の理由を記載`,
    prompt: `キーワード: 「${keyword}」

以下の26香料すべてに対してweightを判定してください:
${flavorListStr}`,
    maxTokens: 4000,
    temperature: 0.3,
  });

  return object.rules;
}

/**
 * 全16キーワード × 26香料 = 416ルールを生成し、JSONファイルに出力
 */
async function generateAllBaseRules() {
  const allRules: Record<string, typeof ruleSchema._type.rules> = {};

  for (const keyword of PRESET_KEYWORDS) {
    console.log(`Generating rules for: ${keyword}`);
    allRules[keyword] = await generateRulesForKeyword(keyword);
    // API レート制限対策
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // JSON出力（レビュー用）
  const outputPath = 'data/base-rules-generated.json';
  await Bun.write(outputPath, JSON.stringify(allRules, null, 2));
  console.log(`Generated ${Object.values(allRules).flat().length} rules → ${outputPath}`);
}
```

**実行フロー:**

```
1. scripts/generate-base-rules.ts 実行
   → data/base-rules-generated.json 出力（416ルール + reasoning）

2. 専門家レビュー（Phase 2）

3. レビュー済みデータ → seed スクリプトに統合
   → packages/db/src/seed.ts の seed() 内で INSERT
```

**出力JSON構造:**

```json
{
  "夏": [
    { "keyword": "夏", "flavorNameEn": "Lime", "noteType": "TOP", "weight": 0.85, "reasoning": "夏の爽快感を代表する柑橘" },
    { "keyword": "夏", "flavorNameEn": "Grapefruit", "noteType": "TOP", "weight": 0.80, "reasoning": "みずみずしさが夏に最適" },
    { "keyword": "夏", "flavorNameEn": "Sea Blue", "noteType": "TOP", "weight": 0.90, "reasoning": "海を直接連想させる" },
    { "keyword": "夏", "flavorNameEn": "Vanilla", "noteType": "LAST", "weight": 0.10, "reasoning": "夏には重すぎるが微量のアクセント" }
  ],
  "ロマンティック": [
    { "keyword": "ロマンティック", "flavorNameEn": "Sweet Rose", "noteType": "MIDDLE", "weight": 0.95, "reasoning": "バラはロマンスの象徴" },
    { "keyword": "ロマンティック", "flavorNameEn": "Jasmine", "noteType": "MIDDLE", "weight": 0.85, "reasoning": "甘美なフローラルで官能的" }
  ]
}
```

**コスト見積:**

| 項目 | 値 |
|------|-----|
| API呼び出し | 16回（キーワード単位） |
| トークン/回 | 入力 ~500 + 出力 ~3,000 |
| 合計トークン | ~56,000 |
| 推定コスト | ~$3〜5（GPT-4） |
| 実行時間 | ~3分 |

#### Phase 2: 専門家レビュー（ローンチ前 — 品質担保）

AI生成結果を調香の専門知識でレビュー・修正する。

**レビュー方法:**

```
1. data/base-rules-generated.json を CSV/スプレッドシートに変換

2. レビュー観点:
   ┌──────────────────────────────────────────────────────────┐
   │ a. weight の妥当性                                        │
   │    「夏 × バニラ = 0.10」は適切か？                         │
   │                                                          │
   │ b. ノートバランス                                         │
   │    各キーワードで TOP/MIDDLE/LAST の配分が偏りすぎていないか   │
   │                                                          │
   │ c. 配合テスト                                             │
   │    代表的な組み合わせ（夏+さわやか、冬+高級 etc.）で         │
   │    実際に配合計算を実行し、結果が妥当か検証                  │
   │                                                          │
   │ d. 欠落チェック                                            │
   │    全キーワードで weight > 0 が各ノートに最低2種あるか       │
   └──────────────────────────────────────────────────────────┘

3. 修正後 → data/base-rules-reviewed.json として保存
```

**レビュー用検証スクリプト:**

```typescript
// scripts/validate-base-rules.ts

interface ValidationResult {
  keyword: string;
  issues: string[];
}

function validateRules(rules: Record<string, Rule[]>): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [keyword, flavorRules] of Object.entries(rules)) {
    const issues: string[] = [];

    // 26香料すべてにルールがあるか
    if (flavorRules.length !== 26) {
      issues.push(`香料数が${flavorRules.length}/26`);
    }

    // 各ノートに weight > 0 が最低2種あるか
    for (const noteType of ['TOP', 'MIDDLE', 'LAST']) {
      const activeCount = flavorRules.filter(
        r => r.noteType === noteType && r.weight > 0
      ).length;
      if (activeCount < 2) {
        issues.push(`${noteType} のアクティブ香料が${activeCount}種（最低2種必要）`);
      }
    }

    // weight の合計が極端でないか（各ノート内）
    for (const noteType of ['TOP', 'MIDDLE', 'LAST']) {
      const noteRules = flavorRules.filter(r => r.noteType === noteType);
      const totalWeight = noteRules.reduce((sum, r) => sum + r.weight, 0);
      if (totalWeight < 0.5) {
        issues.push(`${noteType} の weight 合計が低すぎる: ${totalWeight.toFixed(2)}`);
      }
    }

    // 全ての weight が 0.0 のキーワードがないか
    const totalActive = flavorRules.filter(r => r.weight > 0).length;
    if (totalActive < 5) {
      issues.push(`アクティブ香料が${totalActive}種しかない（最低5種推奨）`);
    }

    if (issues.length > 0) {
      results.push({ keyword, issues });
    }
  }

  return results;
}
```

**配合シミュレーション:**

```typescript
// scripts/simulate-blend.ts
// レビュー用: 代表的なキーワード組み合わせで配合結果をプレビュー

const TEST_CASES = [
  { keywords: ['夏', 'さわやか'], label: '夏×さわやか' },
  { keywords: ['冬', '高級'], label: '冬×高級' },
  { keywords: ['春', 'ロマンティック'], label: '春×ロマンティック' },
  { keywords: ['秋', 'ミステリアス'], label: '秋×ミステリアス' },
  { keywords: ['リラックス', 'ナチュラル'], label: 'リラックス×ナチュラル' },
  { keywords: ['セクシー', '優雅'], label: 'セクシー×優雅' },
];

// 各テストケースで calculateAutoBlendGrouped() を実行し、
// 上位5香料と比率を出力 → 調香師が「この組み合わせは自然か」を判定
```

#### Phase 2.5: AIレシピ提案 → Shimizu フィードバックループ（ローンチ前 — 反復精製）

Phase 1〜2 で生成したベースルールを使い、AIが代表テーマで配合レシピを自動生成。
Shimizu がそのレシピを評価し、ギャップがある場合は**構造化された理由**を選択する。
フィードバックを元にルールの weight を自動補正し、再度レシピを生成 → 評価 → 収束するまで反復する。

**フロー:**

```
AIがベースルールで配合生成（30テーマ × 1〜2パターン = 30〜60レシピ）
     ↓
Shimizu が各レシピを評価（5段階 + ギャップ理由選択）
     ↓
フィードバックからルール weight を自動補正
     ↓
再生成 → 再評価 → ... （2〜3回反復で収束）
```

**評価UI: `/admin/calibration`**

```
キャリブレーション                             [3/30 完了]

── テーマ: デート × 明るい ──

AI提案レシピ:

  TOP (35%)
    ベルガモット  ━━━━━━━━━━━━━━━━ 18%
    レモン       ━━━━━━━━━━━━━━━  10%
    カシス       ━━━━━━━━░░░░░░░░  7%

  MIDDLE (45%)
    ジャスミン    ━━━━━━━━━━━━━━━━ 16%
    ミュゲ       ━━━━━━━━━━━━━━░░ 14%
    スウィートローズ ━━━━━━━━━━━━━━ 15%

  LAST (20%)
    ムスク       ━━━━━━━━━━━━━━━  12%
    サンダルウッド ━━━━━━━━░░░░░░░░  8%

  [ドーナツチャート]  [フレグランスマップ]

── 評価 ──

この配合はあなたのイメージに合っていますか？

  ★★★★★  ぴったり
  ★★★★☆  おおむね良い
  ★★★☆☆  まあまあ
  ★★☆☆☆  ちょっと違う
  ★☆☆☆☆  全然違う

── ギャップ理由（★3以下の場合） ──

どこが違いますか？（複数選択可）

  □ 特定の香料が強すぎる → [ジャスミン ▼] が強い
  □ 特定の香料が弱すぎる → [ベルガモット ▼] をもっと
  □ 不要な香料がある     → [カシス ▼] は要らない
  □ 足りない香料がある   → [ラベンダー ▼] を入れたい
  □ TOP が強すぎる / 弱すぎる
  □ MIDDLE が強すぎる / 弱すぎる
  □ LAST が強すぎる / 弱すぎる
  □ 全体的に重い（もっと軽やかに）
  □ 全体的に軽い（もっと深みを）
  □ テーマの印象と合っていない

コメント（任意）:
[                                              ]

                              [次のレシピへ →]
```

**ギャップ理由の型定義:**

```typescript
type GapReason =
  | { type: 'FLAVOR_TOO_STRONG'; flavorNameEn: string }
  | { type: 'FLAVOR_TOO_WEAK'; flavorNameEn: string }
  | { type: 'FLAVOR_UNWANTED'; flavorNameEn: string }
  | { type: 'FLAVOR_MISSING'; flavorNameEn: string }
  | { type: 'NOTE_TOO_STRONG'; noteType: 'TOP' | 'MIDDLE' | 'LAST' }
  | { type: 'NOTE_TOO_WEAK'; noteType: 'TOP' | 'MIDDLE' | 'LAST' }
  | { type: 'OVERALL_TOO_HEAVY' }
  | { type: 'OVERALL_TOO_LIGHT' }
  | { type: 'THEME_MISMATCH' };

type CalibrationFeedback = {
  themeScene: string;
  themeMood: string;
  generatedFlavors: { flavorNameEn: string; ratio: number; noteType: string }[];
  rating: 1 | 2 | 3 | 4 | 5;
  gapReasons: GapReason[];    // ★3以下の場合
  comment?: string;
  iteration: number;          // 反復回数（1回目、2回目...）
};
```

**フィードバック → ルール自動補正ロジック:**

```typescript
// scripts/apply-calibration-feedback.ts

const ADJUSTMENT_MAP: Record<GapReason['type'], (rule: Rule, reason: GapReason) => number> = {
  FLAVOR_TOO_STRONG:  (rule, r) => rule.flavorNameEn === r.flavorNameEn ? -0.10 : 0,
  FLAVOR_TOO_WEAK:    (rule, r) => rule.flavorNameEn === r.flavorNameEn ? +0.10 : 0,
  FLAVOR_UNWANTED:    (rule, r) => rule.flavorNameEn === r.flavorNameEn ? -0.20 : 0,
  FLAVOR_MISSING:     (rule, r) => rule.flavorNameEn === r.flavorNameEn ? +0.15 : 0,
  NOTE_TOO_STRONG:    (rule, r) => rule.noteType === r.noteType ? -0.05 : 0,
  NOTE_TOO_WEAK:      (rule, r) => rule.noteType === r.noteType ? +0.05 : 0,
  OVERALL_TOO_HEAVY:  (rule) => rule.noteType === 'LAST' ? -0.05 : (rule.noteType === 'TOP' ? +0.03 : 0),
  OVERALL_TOO_LIGHT:  (rule) => rule.noteType === 'LAST' ? +0.05 : (rule.noteType === 'TOP' ? -0.03 : 0),
  THEME_MISMATCH:     () => 0, // コメントから手動分析
};

/**
 * フィードバックからルール weight を補正
 *
 * - 高評価（★4〜5）: 補正なし（現在のルールを肯定）
 * - 中評価（★3）: 小幅補正（上記の半分）
 * - 低評価（★1〜2）: 通常補正
 */
function applyFeedback(
  rules: Record<string, Rule[]>,
  feedbacks: CalibrationFeedback[],
): Record<string, Rule[]> {
  const updatedRules = structuredClone(rules);

  for (const fb of feedbacks) {
    if (fb.rating >= 4) continue; // 高評価はスキップ

    const multiplier = fb.rating <= 2 ? 1.0 : 0.5; // ★3は半分の補正

    // このテーマに関連するキーワードを推定
    const relatedKeywords = inferKeywordsFromTheme(fb.themeScene, fb.themeMood);

    for (const keyword of relatedKeywords) {
      const keywordRules = updatedRules[keyword];
      if (!keywordRules) continue;

      for (const reason of fb.gapReasons) {
        for (const rule of keywordRules) {
          const adjustment = ADJUSTMENT_MAP[reason.type](rule, reason) * multiplier;
          rule.weight = Math.max(0, Math.min(1.0, rule.weight + adjustment));
          rule.weight = Math.round(rule.weight * 20) / 20; // 0.05刻み
        }
      }
    }
  }

  return updatedRules;
}

/**
 * テーマ（シーン×ムード）から関連キーワードを推定
 */
function inferKeywordsFromTheme(scene: string, mood: string): string[] {
  const sceneKeywords: Record<string, string[]> = {
    'デート': ['ロマンティック', 'さわやか'],
    'オフィス': ['クール', 'ナチュラル'],
    'パーティー': ['陽気', 'セクシー', '優雅'],
    'リラックス': ['リラックス', 'まろやか', 'ナチュラル'],
    'アウトドア': ['フレッシュ', 'さわやか'],
    'フォーマル': ['高級', '優雅'],
  };
  const moodKeywords: Record<string, string[]> = {
    '明るい': ['陽気', 'フレッシュ'],
    '落ち着いた': ['リラックス', 'まろやか'],
    '情熱的': ['セクシー', 'ロマンティック'],
    'ミステリアス': ['ミステリアス'],
    '清潔感': ['さわやか', 'フレッシュ', 'クール'],
  };
  return [...new Set([...(sceneKeywords[scene] ?? []), ...(moodKeywords[mood] ?? [])])];
}
```

**反復スケジュール:**

| ラウンド | 内容 | 想定所要時間 |
|---------|------|:----------:|
| Round 1 | 初期ルールで30テーマ生成 → Shimizu 全件評価 | ~1時間 |
| Round 2 | 補正後ルールで ★3以下のテーマのみ再生成 → 再評価 | ~30分 |
| Round 3 | 最終微調整（残りギャップがあれば） | ~15分 |

**収束判定:**
- 全テーマの平均評価が ★4.0 以上
- ★2以下のテーマが 0件
- 前ラウンドからの評価変動が ±0.3 以内

**保存データ:**

```
data/
├── calibration-round-1.json    ← Round 1 の全フィードバック
├── calibration-round-2.json    ← Round 2 のフィードバック
├── calibration-round-3.json    ← Round 3 のフィードバック
├── calibration-summary.json    ← 収束状況サマリー
└── base-rules-calibrated.json  ← キャリブレーション済み最終ルール
```

#### Phase 3: 管理者画面での運用調整（ローンチ後）

ベースAIルールを管理者が GUI で閲覧・編集する画面。

**画面: `/admin/base-rules`**

```
ベースAIルール管理

選択中: [夏 ×]

[🔍 キーワードを検索...                    ]

[すべて(16)] [SEASON(4)] [MOOD(6)] [PLACE(2)] [FREE(4+)]

最近編集: [夏] [リラックス] [ウッディ] [優雅] [春]

┌ キーワード一覧 ─────────────────────────────────────┐
│ 🟡夏  🟡春  🟡秋  🟡冬  🟢さわやか  🟢まろやか    │
│ 🔵ナチュラル  🔵陽気  🔵優雅  🔵高級  🔵リラックス │
│ 🔵ロマンティック  🟣柑橘系  🟣花束  🟣ウッディ      │
│ 🟣スパイシー                                       │
│                    16件表示中 / 全16件               │
└─────────────────────────────────────────────────────┘

[ノート: すべて ▼]  [表示: アクティブのみ □]

── TOP ──
┌──────────────────────────────────────────────────────────┐
│ ライム         ━━━━━━━━━━━━━━━━━░░░░ 0.85   [reasoning] │
│ グレープフルーツ ━━━━━━━━━━━━━━━━░░░░░ 0.80              │
│ レモン         ━━━━━━━━━━━━━━░░░░░░░ 0.70              │
│ オレンジ       ━━━━━━━━━━░░░░░░░░░░░ 0.50              │
│ ベルガモット    ━━━━━━━━━━━━░░░░░░░░░ 0.60              │
│ シーブルー     ━━━━━━━━━━━━━━━━━━░░░ 0.90              │
│ アッサムティ   ━━━░░░░░░░░░░░░░░░░░░░ 0.15              │
│ カシス         ━━━━━━━━░░░░░░░░░░░░░ 0.40              │
└──────────────────────────────────────────────────────────┘
── MIDDLE ──
  ...
── LAST ──
  ...

[配合プレビュー]  [変更を保存]  [変更履歴]  [CSVエクスポート]
```

**機能一覧:**

| 機能 | 説明 |
|------|------|
| キーワードピッカー | インクリメンタルサーチ + カテゴリタブ(SEASON/MOOD/PLACE/FREE) + 最近編集チップで1000件超でも快適に選択 |
| スライダー編集 | 各香料の weight を 0.05 刻みで調整 |
| 配合プレビュー | 現在のルールで代表的な配合をシミュレーション |
| 変更履歴 | 誰がいつ何を変えたかの監査ログ |
| 一括インポート/エクスポート | CSV/JSON での入出力 |
| AI再生成 | 特定キーワードのルールをAIで再生成（既存を上書き確認付き） |

**Server Action:**

```typescript
// actions/admin/base-rules.ts

export async function updateBaseRule(
  keywordId: string,
  flavorId: string,
  weight: number,
): Promise<void> {
  // 権限チェック: ADMIN のみ
  // keyword_flavor_rules WHERE perfumer_id IS NULL AND keyword_id AND flavor_id
  // → weight 更新
  // → 変更履歴（base_rule_audit_log）に記録
}

export async function regenerateBaseRules(
  keywordId: string,
): Promise<{ rules: GeneratedRule[] }> {
  // 権限チェック: ADMIN のみ
  // GPT-4 で対象キーワードの26香料ルールを再生成
  // → プレビュー表示（即反映しない）
  // → 管理者が確認後に適用
}
```

**監査ログテーブル:**

```typescript
// packages/db/src/schema/base-rule-audit-log.ts

export const baseRuleAuditLog = pgTable('base_rule_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => users.id),
  keywordId: uuid('keyword_id').notNull().references(() => keywords.id),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  oldWeight: decimal('old_weight', { precision: 5, scale: 4 }).notNull(),
  newWeight: decimal('new_weight', { precision: 5, scale: 4 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

#### Phase 4: ユーザー行動ベースの自動最適化（データ蓄積後）

実際の注文・評価データからルールの weight を自動調整する学習バッチ。

**対象データ:**

| データソース | 指標 | 影響 |
|-------------|------|------|
| `blend_results` + `orders` | 配合→購入のコンバージョン率 | 高CVRの配合に使われた香料のweight ↑ |
| `recipe_reviews` | レシピの平均評価 | 高評価レシピの配合パターンを学習 |
| `blend_requests` | リピート率（同キーワードの再利用） | リピートされるキーワード×香料のweight ↑ |
| `creator_stats` | 上位クリエーターのスタイル傾向 | Grand Master のスタイルをベースに還元 |

**学習バッチ:**

```typescript
// scripts/optimize-base-rules.ts

/**
 * 月次実行: ユーザー行動データからベースルールの weight を微調整
 *
 * アルゴリズム:
 * 1. 過去3ヶ月の ai_only モード配合で「購入に至った」配合を取得
 * 2. 購入配合で使用されたキーワード×香料ペアの出現頻度を集計
 * 3. 出現頻度 × 注文の評価スコアで「成功スコア」を算出
 * 4. 成功スコアに基づき weight を ±0.05 の範囲で調整
 * 5. 調整結果を base_rule_audit_log に記録（source: 'AUTO_OPTIMIZE'）
 */
async function optimizeBaseRules(targetMonth: string) {
  const { startDate, endDate } = getMonthRange(targetMonth, -3); // 過去3ヶ月

  // 1. 購入に至った ai_only 配合を取得
  const purchasedBlends = await db.query.blendRequests.findMany({
    where: and(
      eq(blendRequests.mode, 'ai_only'),
      eq(blendRequests.status, 'COMPLETED'),
      gte(blendRequests.createdAt, startDate),
      lte(blendRequests.createdAt, endDate),
    ),
    with: {
      keywords: true,
      result: { with: { flavors: true } },
      order: true,  // 購入紐付き
    },
  });

  // 購入ありのみフィルタ
  const successBlends = purchasedBlends.filter(b => b.order != null);

  // 2. キーワード×香料ペアの成功スコア集計
  const scoreMap = new Map<string, { totalScore: number; count: number }>();

  for (const blend of successBlends) {
    const rating = blend.order.rating ?? 3.0; // 未評価は中立
    const score = (rating - 1.0) / 4.0;       // 0〜1 に正規化

    for (const kw of blend.keywords) {
      for (const flavor of blend.result.flavors) {
        if (flavor.ratio > 1.0) { // 1%以上の香料のみ
          const key = `${kw.keywordId}:${flavor.flavorId}`;
          const prev = scoreMap.get(key) ?? { totalScore: 0, count: 0 };
          scoreMap.set(key, {
            totalScore: prev.totalScore + score,
            count: prev.count + 1,
          });
        }
      }
    }
  }

  // 3. weight 調整（最大 ±0.05/月）
  const MAX_ADJUSTMENT = 0.05;

  for (const [key, { totalScore, count }] of scoreMap) {
    if (count < 5) continue; // サンプル数が少ない場合はスキップ

    const avgScore = totalScore / count;
    const adjustment = (avgScore - 0.5) * MAX_ADJUSTMENT * 2; // -0.05〜+0.05

    const [keywordId, flavorId] = key.split(':');
    const currentRule = await getCurrentBaseRule(keywordId, flavorId);
    if (!currentRule) continue;

    const newWeight = Math.max(0, Math.min(1.0,
      parseFloat(currentRule.weight) + adjustment
    ));

    // 0.05 刻みに丸め
    const roundedWeight = Math.round(newWeight * 20) / 20;

    if (roundedWeight !== parseFloat(currentRule.weight)) {
      await updateBaseRuleWeight(keywordId, flavorId, roundedWeight);
      await logAudit(keywordId, flavorId, currentRule.weight, roundedWeight, 'AUTO_OPTIMIZE');
    }
  }
}
```

**安全策:**

| 項目 | 対策 |
|------|------|
| 最大調整幅 | ±0.05/月（急激な変化を防止） |
| 最低サンプル数 | 5件未満のペアはスキップ |
| ロールバック | 監査ログから任意時点に復元可能 |
| 管理者通知 | 調整結果サマリーをメール通知 |
| 手動ロック | 管理者が特定ルールを「ロック」して自動調整対象外にできる |

**実行スケジュール:**

| 項目 | 値 |
|------|-----|
| 実行タイミング | 毎月1日 05:00 JST（ティアバッチの後） |
| 対象データ | 過去3ヶ月のai_only配合データ |
| 前提条件 | ai_only モードの購入データが100件以上蓄積してから開始 |

### 3.5 ベースルール管理画面

管理者がベースAIルールを管理するための専用画面を `/admin/base-rules` に配置する。
詳細は 3.4 Phase 3 を参照。

### 3.6 ルール全体確認画面（マトリクスビュー）

ベースAIルール全416件（16キーワード × 26香料）を一覧で俯瞰する管理者画面。
既存の「キーワード別編集画面」(3.5) が **縦方向の深掘り** なのに対し、
マトリクスビューは **横方向の全体把握** を担う。

**画面: `/admin/rule-matrix`**

```
ルールマトリクス

[ノート: すべて ▼]  [表示: weight値 / ヒートマップ]

         ライム  レモン  ローズ  ラベンダー  ムスク  サンダルウッド  ...
夏       ■0.85  ■0.70  □0.10  □0.05     □0.10  □0.08         ...
春       □0.30  □0.25  ■0.75  ■0.60     □0.15  □0.10         ...
リラックス □0.15  □0.10  ■0.65  ■0.80     ■0.60  ■0.55         ...
高級     □0.20  □0.15  ■0.70  □0.30     ■0.75  ■0.80         ...
...

■ = 高weight (≥0.6)  ▣ = 中 (0.3-0.59)  □ = 低 (<0.3)  ⊘ = 未設定
```

**機能一覧:**

| 機能 | 説明 |
|------|------|
| ヒートマップ表示 | weight値を色の濃さで可視化（白→薄緑→緑→濃緑） |
| ノートタイプ切替 | TOP/MIDDLE/LAST/すべてのフィルタ |
| セルタップ | タップで個別ルール編集画面（3.5）の該当キーワードにジャンプ |
| サマリー統計 | カバレッジ率、平均weight、最大/最小weight、未設定セル数 |
| 異常検出ハイライト | 未設定セル（赤枠）、外れ値（黄枠）を視覚的に強調 |
| 行/列ソート | weight合計で行（キーワード）・列（香料）をソート可能 |
| CSVエクスポート | マトリクス全体をCSV出力 |

**サマリーKPI:**

| KPI | 説明 | 計算方法 |
|-----|------|----------|
| カバレッジ率 | 有効なルール（weight > 0）の割合 | アクティブ数 / 416 × 100 |
| 平均weight | 全アクティブルールの平均 | Σ weight / アクティブ数 |
| キーワード偏差 | キーワード間のweight合計のばらつき | 標準偏差 |
| 空キーワード | ルールが全て0のキーワード数 | count(keyword where Σweight = 0) |
| 空香料 | どのキーワードでも使われていない香料数 | count(flavor where Σweight = 0) |

**異常検出ルール:**

| 種別 | 条件 | 表示 |
|------|------|------|
| 未設定 | weight = 0 または NULL | 赤枠セル |
| 外れ値（高） | weight > μ + 2σ（同一香料内） | 黄枠セル + ⚠️ |
| 外れ値（低） | weight < μ - 2σ かつ weight > 0 | 黄枠セル |
| 偏りキーワード | 1香料がweight合計の50%以上を占める | 行ハイライト |

### 3.7 積層型ルールアーキテクチャ（Additive Layering）

ベースAIルールの weight は**上書き方式ではなく、レイヤーを積層して合算する方式**を採る。
香りの完成像は環境（季節・気温・湿度）やトレンドによって変化するため、
単一の固定値ではなく、複数のコンテキストレイヤーの合算で表現する。

#### 3.7.1 レイヤー構成

```
Layer 0: AI生成ベース（不変の基盤）
  ├── Phase 1 で AI が一括生成した初期値
  └── 原則として変更しない「基礎体力」

Layer 1: Shimizu キャリブレーション補正
  ├── Phase 2.5 のフィードバックループで生成
  └── 創業者の感性を反映する「味付け」

Layer 2: 季節・コンテキスト補正
  ├── 春夏秋冬 + 梅雨/年末年始 等の時期別補正
  └── cron バッチで自動切替

Layer 3: データ駆動学習補正
  ├── Phase 4 の購入データ分析で自動生成
  └── ±0.05/月 の安全制約付き

Layer 4: トレンド補正（将来）
  ├── SNS/検索トレンドを反映
  └── 短期的な流行への追随
```

#### 3.7.2 合算計算

```typescript
type RuleLayer = {
  layerType: 'BASE' | 'CALIBRATION' | 'SEASONAL' | 'DATA_DRIVEN' | 'TREND';
  keywordId: string;
  flavorId: string;
  delta: number;       // Layer 0 は絶対値、Layer 1+ は差分（±）
  validFrom?: Date;    // 有効期間開始（季節補正等で使用）
  validUntil?: Date;   // 有効期間終了
  isActive: boolean;
  createdAt: Date;
  source: string;      // 生成元（'ai-batch-v1', 'shimizu-calibration-r2', 'seasonal-summer-2026', etc.）
};

function computeEffectiveWeight(
  keywordId: string,
  flavorId: string,
  now: Date = new Date()
): number {
  const layers = await db.select()
    .from(ruleLayers)
    .where(and(
      eq(ruleLayers.keywordId, keywordId),
      eq(ruleLayers.flavorId, flavorId),
      eq(ruleLayers.isActive, true),
      or(
        isNull(ruleLayers.validFrom),
        lte(ruleLayers.validFrom, now)
      ),
      or(
        isNull(ruleLayers.validUntil),
        gte(ruleLayers.validUntil, now)
      ),
    ))
    .orderBy(asc(ruleLayers.layerType));

  // Layer 0 (BASE) は絶対値、それ以降は加算
  let weight = 0;
  for (const layer of layers) {
    if (layer.layerType === 'BASE') {
      weight = layer.delta;  // ベース値をセット
    } else {
      weight += layer.delta; // 差分を加算
    }
  }

  // 0.0〜1.0 にクランプ
  // NOTE: 全フレーバーの effectiveWeight 合計が 0 の場合は、呼び出し元で等分配 or エラーとする
  return Math.max(0, Math.min(1, weight));
}
```

#### 3.7.3 メリット

| 観点 | 上書き方式 | 積層方式 |
|------|-----------|---------|
| トレーサビリティ | 現在値のみ | 各レイヤーの寄与が可視化 |
| ロールバック | 監査ログから復元 | レイヤー単位で無効化（即時） |
| 環境対応 | 手動で書き換え | 季節レイヤーが自動切替 |
| A/Bテスト | 困難 | レイヤーの有無で比較可能 |
| 説明可能性 | 「0.85 です」 | 「基盤0.80 + 感性補正+0.05 + 夏期+0.10 − 学習補正-0.10 = 0.85」 |

#### 3.7.4 季節コンテキスト補正の例

```typescript
// 季節レイヤーの自動生成
const SEASONAL_ADJUSTMENTS = {
  SPRING: {  // 3-5月
    // 軽やかなフローラル・グリーンを強調
    'lime': +0.05, 'bergamot': +0.05, 'jasmine': +0.08,
    'lavender': +0.05, 'musk': -0.03, 'sandalwood': -0.05,
  },
  SUMMER: {  // 6-8月
    // シトラス・マリンを強調、重い香りを抑制
    'lime': +0.10, 'grapefruit': +0.08, 'sea_blue': +0.12,
    'vanilla': -0.08, 'sandalwood': -0.05, 'amber': -0.06,
  },
  AUTUMN: {  // 9-11月
    // ウッディ・スパイシーを強調
    'cinnamon': +0.08, 'sandalwood': +0.06, 'cedar': +0.05,
    'lime': -0.05, 'sea_blue': -0.08,
  },
  WINTER: {  // 12-2月
    // オリエンタル・ウォームを強調
    'vanilla': +0.10, 'amber': +0.08, 'musk': +0.06,
    'lime': -0.08, 'grapefruit': -0.06,
  },
};
```

#### 3.7.5 管理画面での表示

マトリクスビュー（3.6）およびキーワード別編集画面（3.5）に、レイヤー分解表示を追加する。

```
ライム  ━━━━━━━━━━━━━━━━━━━━ 0.97
  内訳: ベース 0.80 | 感性 +0.05 | 夏期 +0.10 | 学習 +0.02
  [レイヤー詳細 →]
```

---

## 4. クリエータースタイル

### 4.1 スタイルプロファイル型定義

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

### 4.2 パラメータ説明

| パラメータ | 範囲 | 説明 |
|-----------|------|------|
| `noteBalance.topBias` | -0.3〜+0.3 | TOPノートの比率補正。+で強調、-で抑制 |
| `noteBalance.middleBias` | -0.3〜+0.3 | MIDDLEノートの比率補正 |
| `noteBalance.lastBias` | -0.3〜+0.3 | LASTノートの比率補正 |
| `flavorPreferences[].bias` | -0.5〜+0.5 | 特定香料の重み補正。+で強調、-で抑制 |
| `description` | 自由記述 | ユーザーに表示するスタイル説明文 |
| `stylePrompt` | 自由記述 | AIストーリー生成時の追加コンテキスト |

### 4.3 スタイルの効果例

```
クリエーター「田中花子」のスタイル:
  noteBalance: { topBias: +0.1, middleBias: +0.15, lastBias: -0.1 }
  flavorPreferences: [
    { flavorId: "jasmine", bias: +0.3 },
    { flavorId: "musk", bias: -0.2 },
  ]

効果:
  - TOPノートがやや強調、LASTノートがやや抑制される
  - ジャスミンが強調され、ムスクが抑制される
  - 「フローラル系が華やかに香る」スタイル
```

---

## 5. シグネチャーレシピ

### 5.1 レシピ型定義

```typescript
type SignatureRecipe = {
  id: string;
  creatorId: string;
  name: string;
  concept: string;        // コンセプト説明文
  scene: string;          // L2シーン（デート / オフィス / パーティー / リラックス / アウトドア / フォーマル）
  mood: string;           // L3ムード（明るい / 落ち着いた / 情熱的 / ミステリアス / 清潔感）
  flavors: {
    flavorId: string;
    ratio: number;        // 配合比率（%）
    noteType: string;     // TOP / MIDDLE / LAST
  }[];
  status: 'DRAFT' | 'PUBLISHED';
  price30ml: number;
  price50ml: number;
};
```

### 5.2 レシピのライフサイクル

```
[作成] → DRAFT → [公開] → PUBLISHED → [非公開] → DRAFT
                      ↓
                  販売可能
                  レビュー可能
                  ランキング対象
```

### 5.3 レシピとテーマの関係

各レシピは1つのテーマ（シーン x ムード）に紐付く。
クリエーターは複数のテーマに対してレシピを作成できる。

```
30テーマ
├── デート x 明るい
│   ├── クリエーターA: 「春風のデート」
│   ├── クリエーターB: 「シトラスデート」
│   └── ...
├── デート x 落ち着いた
│   ├── クリエーターA: 「静かな午後」
│   └── ...
└── ...
```

### 5.4 価格設定

| 容量 | 価格設定 | 備考 |
|------|---------|------|
| 30ml | クリエーターが設定 | 必須 |
| 50ml | クリエーターが設定 | 必須 |

---

## 6. 配合計算フロー

### 6.1 ai_only モード

ベースAIルールのみを使用する最もシンプルなモード。

```
Step 1: テーマ + キーワード選択
  ↓
Step 2: ベースルール取得
  keyword_flavor_rules WHERE perfumer_id IS NULL
  AND keyword_id IN (選択キーワードID)
  ↓
Step 3: 加重平均計算
  noteFlavorWeights[noteType][flavorId] = Σ(rule.weight x keyword.weight)
  ↓
Step 4: ノートタイプ別正規化 → 最終配合比率算出
  ↓
Step 5: 結果表示
```

### 6.2 styled モード

ベースAI配合にクリエータースタイル補正を適用するモード。

```
Step 1: テーマ + キーワード選択 + クリエーター選択
  ↓
Step 2: ベースルール取得（ai_only と同じ）
  keyword_flavor_rules WHERE perfumer_id IS NULL
  ↓
Step 3: 加重平均計算（ai_only と同じ）
  ↓
Step 4: クリエータースタイル補正適用
  4-1. ノートバランス補正:
    ratio[note] += style.noteBalance[note]Bias
    ※ 補正後に再正規化（TOP + MIDDLE + LAST = 100%）
  4-2. 香料プリファレンス補正:
    weight[flavor] *= (1 + style.flavorPreferences[flavor].bias)
    ※ 各ノート内で再正規化（合計 = 1.0）
  ↓
Step 5: 再正規化（合計 = 100%）
  ↓
Step 6: 結果表示
```

**計算例（styled モード）:**

```
入力:
  キーワード「夏」(weight=7) + クリエーター「田中花子」
  ベースAIルール: ライム(TOP) 0.8, ベルガモット(TOP) 0.6
  ノート比率: TOP=35%, MIDDLE=55%, LAST=10%
  田中花子スタイル: topBias=+0.1, lastBias=-0.1

Step 3: ベース加重平均（ai_only と同じ）
  ライム: 5.6, ベルガモット: 4.2

Step 4-1: ノートバランス補正
  TOP: 35% + 10% = 45%
  MIDDLE: 55% + 0% = 55%
  LAST: 10% - 10% = 0% → 正規化後: TOP=45%, MIDDLE=55%, LAST=0%
  ※ 実際には最低比率制約あり

Step 4-2: 香料プリファレンス（該当なければスキップ）

Step 5: 最終比率
  ライム: 0.5714 x 0.45 x 100 = 25.71%
  ベルガモット: 0.4286 x 0.45 x 100 = 19.29%
```

### 6.3 recipe モード

クリエーターのシグネチャーレシピの配合をそのまま使用する。計算不要。

```
Step 1: レシピ選択（一覧/検索から）
  ↓
Step 2: レシピの配合データ取得
  signature_recipe_flavors WHERE recipe_id = 選択レシピID
  ↓
Step 3: 配合をそのまま使用（計算不要）
  ↓
Step 4: 結果表示 + 購入フローへ
```

---

## 7. DBスキーマ

### 7.1 creator_profiles テーブル拡張

既存の `creator_profiles` テーブルにスタイル関連カラムを追加する。

```typescript
// 追加カラム
styleNoteBalance: jsonb('style_note_balance')
  .$type<{
    topBias: number;      // -0.3〜+0.3
    middleBias: number;   // -0.3〜+0.3
    lastBias: number;     // -0.3〜+0.3
  }>(),

styleFlavorPreferences: jsonb('style_flavor_preferences')
  .$type<{
    flavorId: string;
    bias: number;         // -0.5〜+0.5
  }[]>(),
```

### 7.2 新テーブル: signature_recipes

```typescript
// packages/db/src/schema/signature-recipes.ts

export const signatureRecipeStatusEnum = ['DRAFT', 'PUBLISHED'] as const;
export type SignatureRecipeStatus = (typeof signatureRecipeStatusEnum)[number];

export const signatureRecipes = pgTable(
  'signature_recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // クリエーター
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // レシピ情報
    name: varchar('name', { length: 100 }).notNull(),
    concept: text('concept').notNull(),
    scene: varchar('scene', { length: 30 }).notNull(),   // L2シーン
    mood: varchar('mood', { length: 30 }).notNull(),     // L3ムード

    // 公開状態
    status: varchar('status', { length: 20 })
      .notNull()
      .default('DRAFT')
      .$type<SignatureRecipeStatus>(),

    // 価格
    price30ml: integer('price_30ml').notNull(),
    price50ml: integer('price_50ml').notNull(),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_signature_recipes_creator').on(table.creatorId),
    index('idx_signature_recipes_status').on(table.status),
    index('idx_signature_recipes_scene_mood').on(table.scene, table.mood),
  ],
);
```

### 7.3 新テーブル: signature_recipe_flavors

```typescript
// packages/db/src/schema/signature-recipe-flavors.ts

export const signatureRecipeFlavors = pgTable(
  'signature_recipe_flavors',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => signatureRecipes.id, { onDelete: 'cascade' }),

    flavorId: uuid('flavor_id')
      .notNull()
      .references(() => flavors.id),

    ratio: decimal('ratio', { precision: 5, scale: 2 }).notNull(),     // 配合比率（%）
    noteType: varchar('note_type', { length: 10 }).notNull(),           // TOP / MIDDLE / LAST

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_signature_recipe_flavors_recipe').on(table.recipeId),
  ],
);
```

### 7.4 新テーブル: recipe_stats

```typescript
// packages/db/src/schema/recipe-stats.ts

export const recipeStats = pgTable(
  'recipe_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    recipeId: uuid('recipe_id')
      .notNull()
      .unique()
      .references(() => signatureRecipes.id, { onDelete: 'cascade' }),

    // 集計カラム
    salesCount: integer('sales_count').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
    favoriteCount: integer('favorite_count').notNull().default(0),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_recipe_stats_recipe').on(table.recipeId),
    index('idx_recipe_stats_sales').on(table.salesCount),
  ],
);
```

### 7.5 ER図

```
keyword_flavor_rules
├── perfumer_id = NULL  → ベースAIルール（プラットフォーム管理）
└── perfumer_id = UUID  → クリエーター個別ルール（従来互換、段階的廃止予定）

creator_profiles
├── style_note_balance (jsonb)        → スタイルプロファイル
├── style_flavor_preferences (jsonb)  → 香料プリファレンス
└── style_description, style_prompt   → 既存カラム

users (CREATOR)
  │
  ├── 1:1 ── creator_profiles（スタイル情報を含む）
  │
  └── 1:N ── signature_recipes
               ├── name, concept
               ├── scene (L2), mood (L3)
               ├── status (DRAFT/PUBLISHED)
               ├── price_30ml, price_50ml
               │
               ├── 1:N ── signature_recipe_flavors
               │            ├── flavor_id → flavors
               │            ├── ratio (%)
               │            └── note_type
               │
               └── 1:1 ── recipe_stats
                            ├── sales_count
                            ├── review_count
                            ├── avg_rating
                            └── favorite_count
```

---

## 8. ユーザーフロー図

### 8.1 3入口の統合フロー

```
┌─────────────────────────────────────────────────────────────┐
│                      トップページ                            │
│                                                             │
│  ┌──────────────┐ ┌──────────────────┐ ┌────────────────┐  │
│  │ AIおまかせ    │ │ クリエータースタイル│ │ レシピから選ぶ  │  │
│  │ で調合する    │ │ で調合する        │ │               │  │
│  └──────┬───────┘ └────────┬─────────┘ └───────┬────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│  ┌──────────────┐ ┌──────────────────┐ ┌────────────────┐  │
│  │ テーマ選択    │ │ テーマ選択        │ │ レシピ一覧     │  │
│  │ シーン x ムード│ │ シーン x ムード   │ │ フィルタ/検索  │  │
│  └──────┬───────┘ └────────┬─────────┘ │ クリエーター別  │  │
│         │                  │           │ テーマ別        │  │
│         ▼                  ▼           └───────┬────────┘  │
│  ┌──────────────┐ ┌──────────────────┐         │           │
│  │ キーワード選択 │ │ キーワード選択    │         │           │
│  └──────┬───────┘ └────────┬─────────┘         │           │
│         │                  │                    │           │
│         │                  ▼                    ▼           │
│         │         ┌──────────────────┐ ┌────────────────┐  │
│         │         │ クリエーター選択   │ │ レシピ詳細     │  │
│         │         │ スタイル紹介表示  │ │ 配合/コンセプト │  │
│         │         └────────┬─────────┘ └───────┬────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    配合結果画面                        │  │
│  │  ドーナツチャート / ノート構造 / AIストーリー            │  │
│  │  フレグランスマップ / 類似フレグランスTop3               │  │
│  └──────────────────────────────┬───────────────────────┘  │
│                                 │                           │
│                                 ▼                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    購入フロー                          │  │
│  │  容量選択 → カート → 注文 → 決済                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 モード別の主要差分

| 項目 | ai_only | styled | recipe |
|------|---------|--------|--------|
| テーマ選択 | 必須 | 必須 | 不要（レシピに含まれる） |
| キーワード選択 | 必須 | 必須 | 不要 |
| クリエーター選択 | 不要 | 必須 | レシピ経由で決定 |
| 配合計算 | ベースAIのみ | ベースAI + スタイル補正 | 計算なし（レシピ直接） |
| ロイヤリティ | なし | クリエーターに発生 | クリエーターに発生 |

---

## 9. API / Server Action 変更

### 9.1 executeBlend 拡張

```typescript
export async function executeBlend(params: {
  userId: string;
  mode: 'ai_only' | 'styled' | 'recipe';  // 追加
  creatorId?: string;                       // styled モード時
  recipeId?: string;                        // recipe モード時
  keywords?: { word: string; weight: number }[];
  topRatio?: number;
  middleRatio?: number;
  lastRatio?: number;
}): Promise<ExecuteBlendResult>
```

### 9.2 レシピ CRUD

| Action | 説明 | 権限 |
|--------|------|------|
| `createRecipe` | シグネチャーレシピ作成 | CREATOR |
| `updateRecipe` | レシピ更新 | CREATOR（自分のレシピ） |
| `publishRecipe` | レシピ公開 | CREATOR（自分のレシピ） |
| `unpublishRecipe` | レシピ非公開化 | CREATOR（自分のレシピ） |
| `deleteRecipe` | レシピ削除 | CREATOR（自分のレシピ） / ADMIN |
| `getRecipeDetail` | レシピ詳細取得 | 公開レシピは全ユーザー |
| `listRecipes` | レシピ一覧取得 | 公開レシピは全ユーザー |

---

## 10. ユーザー嗜好プロファイリング（リビングプロファイル）

### 10.1 概要

ユーザーの香り嗜好を**一度きりのスナップショットではなく、継続的に進化する「生きたプロファイル」**として管理する。

香りの好みは固定ではない:
- **価値観の変化** — 年齢、ライフステージ、環境で好みが変わる
- **新しい発見** — 旅先の香り、季節の移ろい、人からの影響
- **今の気分** — 今日はリフレッシュしたい / 落ち着きたい / 冒険したい

**設計原則:**

| 原則 | 説明 |
|------|------|
| 蓄積型 | 過去のデータは上書きせず、時系列で保持 |
| 低負荷 | 毎回の質問は1-2タップで完了 |
| 任意参加 | スキップ可能、回答なしでもサービス利用可 |
| 即時反映 | 回答がリアルタイムで次の配合に影響 |

### 10.2 データ収集の3チャネル

#### チャネル1: 初回オンボーディング（登録直後、約2分）

```
Step 1: 香りの系統を選ぶ（複数選択可）
┌──────┐ ┌──────┐ ┌──────┐
│ 🌸    │ │ 🍋    │ │ 🌲    │
│フローラル│ │シトラス│ │ウッディ│
└──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐ ┌──────┐
│ ✨    │ │ 💧    │ │ 🍰    │
│オリエンタル│ │フレッシュ│ │グルマン│
└──────┘ └──────┘ └──────┘

Step 2: 好きな香水・使ったことのある香水（任意、スキップ可）
[検索: ブランド名/商品名...]
人気: Acqua di Gio | Light Blue | Miss Dior | ...
各選択に ♡好き / ○普通 / ×苦手 を評価

Step 3: 好みの傾向（スライダー5軸）
軽い ◀━━━━━●━━━━━▶ 重い
ドライ ◀━━━━━━━●━━━▶ スウィート
クール ◀━━━●━━━━━━━▶ ウォーム
カジュアル ◀━━━━━●━━━━━▶ フォーマル
さりげなく ◀━━━━━━━━●━━▶ しっかり
```

| 系統 | 説明例 | 代表的な香水 |
|------|--------|------------|
| フローラル | バラやジャスミンの華やかな香り | Miss Dior, J'adore |
| シトラス | レモンやベルガモットの爽やかな香り | Acqua di Gio |
| ウッディ | サンダルウッドやシダーの深い香り | Terre d'Hermès |
| オリエンタル | バニラやムスクの妖艶な香り | Shalimar |
| フレッシュ | 清潔感のあるクリーンな香り | Light Blue |
| グルマン | スイーツのような甘い香り | Angel |

#### チャネル2: マイクロチェックイン（定期・イベント駆動）

ユーザーに定期的に軽い質問を投げかけ、嗜好の変化を捉える。

| タイミング | トリガー | 質問例 | 回答形式 |
|-----------|---------|--------|---------|
| 配合リクエスト時 | 毎回（任意） | 「今日の気分は？」 | 1タップ: 6つの気分カード |
| 商品到着後 | 配送完了+3日 | 「届いた香り、いかがですか？」 | ★5段階 + 一言 |
| 月1回 | プッシュ通知 | 「最近新しい香りに出会いましたか？」 | テキスト or スキップ |
| 季節の変わり目 | 3/6/9/12月 | 「季節が変わりました。好みに変化は？」 | スライダー5軸の再回答 |
| 記念日系 | 誕生日/記念日 | 「特別な日の香りを探しましょう」 | テーマ提案 |

**気分カード（配合リクエスト時）:**

```
今日の気分は？（タップで選択、スキップ可）

┌────┐ ┌────┐ ┌────┐
│ 🌿  │ │ ⚡  │ │ 🌙  │
│リフレ│ │元気に│ │落ち着│
│ッシュ│ │なりたい│ │きたい│
└────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│ 💎  │ │ 🌺  │ │ 🔥  │
│特別な│ │華やか│ │冒険  │
│気分 │ │な気分│ │したい│
└────┘ └────┘ └────┘
```

#### チャネル3: 暗黙的フィードバック（行動データ）

ユーザーの明示的な回答なしに、行動パターンから嗜好を推定する。

| データソース | 推定内容 | 反映方法 |
|------------|---------|---------|
| 購入履歴 | 実際に購入した配合の傾向 | 購入した配合の香料をブースト |
| リピート注文 | 強い嗜好の確認 | リピート香料を強くブースト |
| お気に入り | 興味の方向性 | 弱めのブースト |
| レビュー | 満足度と理由 | 高評価レシピの香料をブースト |
| 閲覧履歴 | 潜在的な興味 | ごく弱めの信号として記録 |
| 調合の再調整 | 不満の方向性 | 減らした香料をサプレス |

### 10.3 嗜好プロファイル型定義

```typescript
// 嗜好スナップショット（時系列で蓄積）
type TasteSnapshot = {
  id: string;
  userId: string;
  channel: 'ONBOARDING' | 'CHECKIN_MOOD' | 'CHECKIN_SEASONAL'
         | 'CHECKIN_DISCOVERY' | 'IMPLICIT_PURCHASE' | 'IMPLICIT_REVIEW';

  // 回答データ（チャネルにより異なる）
  data: OnboardingData | MoodData | SeasonalData | DiscoveryData | ImplicitData;

  createdAt: Date;
};

// 初回オンボーディング
type OnboardingData = {
  type: 'ONBOARDING';
  families: { family: string; selected: boolean }[];
  fragrances: { name: string; brand: string; rating: 'LIKE' | 'NEUTRAL' | 'DISLIKE' }[];
  axes: {
    weight: number;      // -1.0〜+1.0
    sweetness: number;
    temperature: number;
    formality: number;
    intensity: number;
  };
};

// 気分チェックイン
type MoodData = {
  type: 'MOOD';
  mood: 'REFRESH' | 'ENERGIZE' | 'CALM' | 'SPECIAL' | 'GLAMOROUS' | 'ADVENTURE';
};

// 季節チェックイン
type SeasonalData = {
  type: 'SEASONAL';
  season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  axesUpdate: Partial<OnboardingData['axes']>;  // 変化があった軸のみ
};

// 新発見チェックイン
type DiscoveryData = {
  type: 'DISCOVERY';
  description: string;  // 自由記述
  relatedFamilies?: string[];
};

// 暗黙的フィードバック
type ImplicitData = {
  type: 'IMPLICIT';
  action: 'PURCHASE' | 'REPEAT' | 'FAVORITE' | 'HIGH_REVIEW' | 'LOW_REVIEW';
  blendId?: string;
  recipeId?: string;
  flavorWeights: { flavorId: string; signal: number }[];  // 推定信号
};
```

### 10.4 合算プロファイル（ComputedTasteProfile）

蓄積された全スナップショットから、**現在有効な嗜好ベクトル**を計算する。
新しいデータほど重み付けが高い（時間減衰）。

```typescript
type ComputedTasteProfile = {
  userId: string;

  // 26香料への嗜好ベクトル（AI計算）
  flavorAffinities: {
    flavorId: string;
    affinity: number;     // -0.3〜+0.3
    confidence: number;   // 0.0〜1.0（データ量に応じた確信度）
  }[];

  // 現在の気分補正（直近の MOOD チェックインから）
  currentMoodModifier?: {
    mood: string;
    flavorAdjustments: { flavorId: string; delta: number }[];
    expiresAt: Date;   // 24時間で失効
  };

  // メタ
  snapshotCount: number;
  lastUpdatedAt: Date;
  computedAt: Date;
};

// 時間減衰計算
function computeDecayWeight(snapshotDate: Date, now: Date): number {
  const daysDiff = (now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24);
  // 半減期90日の指数関数減衰
  return Math.exp(-0.693 * daysDiff / 90);
}
```

### 10.5 配合への反映

ai_only / styled モードの配合計算において、ユーザー嗜好を反映する。

```
配合計算フロー（更新版）:

  Step 1: テーマ + キーワード選択
  Step 2: ベースルール取得（積層型: 全レイヤー合算）
  Step 3: 加重平均計算
  ↓
  Step 3.5: ユーザー嗜好補正（ComputedTasteProfile がある場合）
    weight[flavor] *= (1 + user.flavorAffinities[flavor].affinity * confidence)
    ※ confidence が低い（データ不足）場合は影響を弱める
  ↓
  Step 3.6: 気分補正（currentMoodModifier がある場合）
    weight[flavor] += mood.flavorAdjustments[flavor].delta
    ※ 24時間で自動失効
  ↓
  Step 4: [styled] クリエータースタイル補正
  Step 5: 正規化 → 最終配合
```

**補正の優先順位と強さ:**

| 順序 | 補正 | 最大影響幅 | 説明 |
|------|------|-----------|------|
| 1 | ベースAIルール（積層型） | 基盤 | キーワード×香料の基本weight |
| 2 | ユーザー嗜好 | ±0.3 | 長期的な好み傾向 |
| 3 | 気分補正 | ±0.15 | その日の気分（短期） |
| 4 | クリエータースタイル | ±0.5 | クリエーターの個性（styled時） |

### 10.6 DBスキーマ

```typescript
// packages/db/src/schema/taste-snapshots.ts

export const tasteSnapshotChannelEnum = [
  'ONBOARDING', 'CHECKIN_MOOD', 'CHECKIN_SEASONAL',
  'CHECKIN_DISCOVERY', 'IMPLICIT_PURCHASE', 'IMPLICIT_REVIEW',
] as const;

export const tasteSnapshots = pgTable(
  'taste_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    channel: varchar('channel', { length: 30 })
      .notNull()
      .$type<(typeof tasteSnapshotChannelEnum)[number]>(),

    data: jsonb('data').notNull(),   // TasteSnapshot の data フィールド

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_taste_snapshots_user').on(table.userId),
    index('idx_taste_snapshots_user_channel').on(table.userId, table.channel),
    index('idx_taste_snapshots_created').on(table.createdAt),
  ],
);

// 計算済み嗜好プロファイル（キャッシュ）
export const computedTasteProfiles = pgTable(
  'computed_taste_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    flavorAffinities: jsonb('flavor_affinities')
      .$type<{ flavorId: string; affinity: number; confidence: number }[]>()
      .notNull()
      .default([]),

    currentMoodModifier: jsonb('current_mood_modifier')
      .$type<{
        mood: string;
        flavorAdjustments: { flavorId: string; delta: number }[];
        expiresAt: string;
      } | null>()
      .default(null),

    snapshotCount: integer('snapshot_count').notNull().default(0),
    lastSnapshotAt: timestamp('last_snapshot_at'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_computed_taste_profiles_user').on(table.userId),
  ],
);
```

### 10.7 再計算トリガー

| イベント | 処理 |
|---------|------|
| 新しい taste_snapshot 追加 | computed_taste_profiles を再計算 |
| 気分チェックイン | currentMoodModifier を更新（24h TTL） |
| 日次バッチ | 期限切れ mood modifier のクリーンアップ |
| 月次バッチ | 全ユーザーの flavorAffinities を再計算（減衰反映） |

---

## 11. AI プロバイダー戦略（マルチモデル設計）

### 11.1 現状の課題

現在の `ai-client.ts` は OpenAI GPT-4 単一プロバイダーに依存している。

**既存実装の問題:**

| 問題 | 詳細 |
|------|------|
| 旧モデル使用 | `gpt-4`（レガシー）。`gpt-4o` / `gpt-4o-mini` に未移行 |
| 構造化出力なし | `suggestRules()` が `generateText()` + 手動 `JSON.parse()`。パース失敗リスクあり |
| 単一プロバイダー依存 | OpenAI 障害時にフォールバックがテンプレート文のみ |
| 用途別最適化なし | 創作文（story）と構造化 JSON（rules）に同一モデル・同一手法 |
| コスト非効率 | 軽量タスクにも GPT-4（$30/$60 per 1M tok）を使用 |

### 11.2 マルチプロバイダー方針

Vercel AI SDK は `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` をサポートしており、
`model` パラメータの差し替えだけでプロバイダーを切り替え可能。
用途ごとに最適なモデルを選定し、コスト・品質・レイテンシを最適化する。

```
package.json（追加パッケージ）:
  "@ai-sdk/openai": "^1"      ← 既存
  "@ai-sdk/anthropic": "^1"   ← 追加
  "@ai-sdk/google": "^1"      ← 追加

.env:
  OPENAI_API_KEY=sk-...        ← 既存
  ANTHROPIC_API_KEY=sk-ant-... ← 追加
  GOOGLE_GENERATIVE_AI_API_KEY=... ← 追加
```

### 11.3 3社比較サマリー

#### 価格（1Mトークンあたり、USD）

| モデル | 入力 | 出力 | バッチ入力 | バッチ出力 | コンテキスト |
|--------|------|------|-----------|-----------|------------|
| **OpenAI GPT-4o** | $2.50 | $10.00 | $1.25 | $5.00 | 128K |
| **OpenAI GPT-4o-mini** | $0.15 | $0.60 | $0.075 | $0.30 | 128K |
| **OpenAI GPT-4.1** | $2.00 | $8.00 | $1.00 | $4.00 | 1M |
| **Anthropic Claude Haiku 4.5** | $1.00 | $5.00 | $0.50 | $2.50 | 200K |
| **Anthropic Claude Sonnet 4.5** | $3.00 | $15.00 | $1.50 | $7.50 | 200K |
| **Google Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | $0.05 | $0.20 | 1M |
| **Google Gemini 2.5 Flash** | $0.30 | $2.50 | $0.15 | $1.25 | 1M |
| **Google Gemini 2.5 Pro** | $1.25 | $10.00 | $0.625 | $5.00 | 1M |

#### 機能比較

| 観点 | OpenAI | Anthropic | Google Gemini |
|------|--------|-----------|---------------|
| 構造化 JSON 出力 | GA（最も成熟） | GA（4.5系全モデル） | GA（2.5系全モデル） |
| 日本語品質 | 非常に良い | **最も優秀**（ベンチマーク1位） | 非常に良い |
| レイテンシ（TTFT） | ~0.5s（良い） | ~2.0s（やや遅い） | **~0.3s（最速）** |
| バッチ API | 50%OFF、24h以内 | 50%OFF、24h以内 | 50%OFF |
| 無料枠 | なし | なし | **あり（15 RPM）** |
| ツール呼び出し | 最も成熟 | GA（全モデル） | GA（全モデル） |

### 11.4 用途別モデル割当

**初期方針: 全関数を Claude Sonnet 4.5 で統一して開始し、運用データを見てコスト最適化が必要な関数のみ他モデルに切り替える。**

#### A. 配合エンジン（既存7関数）

| # | 関数 | 用途 | 初期モデル | 将来の最適化候補 | SDK メソッド |
|---|------|------|-----------|----------------|------------|
| 1 | `generateStory()` | 配合ストーリー生成 | **Claude Sonnet 4.5** | — | `generateText()` |
| 2 | `suggestRules()` | キーワード→ルール JSON | **Claude Sonnet 4.5** | GPT-4o-mini（コスト削減時） | `generateObject()` + Zod |
| 3 | `generateBaseRules()` | 416ルール一括生成 | **Claude Sonnet 4.5** | Gemini Flash batch（コスト削減時） | `generateObject()` + Zod |
| 4 | `analyzeUserTaste()` | ユーザー嗜好→香料ベクトル | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateObject()` + Zod |
| 5 | `calibrationFeedback()` | Shimizuフィードバック分析 | **Claude Sonnet 4.5** | — | `generateObject()` + Zod |
| 6 | `optimizeBaseRules()` | 月次自動学習バッチ | **Claude Sonnet 4.5** | GPT-4o-mini batch（コスト削減時） | `generateObject()` + Zod |
| 7 | `generateSeasonalLayer()` | 季節レイヤー生成 | **Claude Sonnet 4.5** | GPT-4o-mini（コスト削減時） | `generateObject()` + Zod |

#### B. ユーザー体験（新規5関数）

| # | 関数 | 用途 | 初期モデル | 将来の最適化候補 | SDK メソッド |
|---|------|------|-----------|----------------|------------|
| 8 | `generateRecipeDescription()` | レシピ配合データからコンセプト説明文を自動生成 | **Claude Sonnet 4.5** | — | `generateText()` |
| 9 | `recommendCreators()` | ユーザー嗜好に合うクリエーターを理由付きで推薦 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateObject()` + Zod |
| 10 | `recommendRecipes()` | 嗜好+行動データから「あなたにおすすめ」レシピを推薦 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateObject()` + Zod |
| 11 | `interpretCheckinResponse()` | チェックイン自由記述を解釈し嗜好スナップショットに変換 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateObject()` + Zod |
| 12 | `generateProductDescription()` | EC出品時にレシピ→商品ページ訴求テキストを生成 | **Claude Sonnet 4.5** | — | `generateText()` |

#### C. クリエーター支援（新規3関数）

| # | 関数 | 用途 | 初期モデル | 将来の最適化候補 | SDK メソッド |
|---|------|------|-----------|----------------|------------|
| 13 | `assistRecipeCreation()` | テーマ+コンセプトから配合案を3パターン提案 | **Claude Sonnet 4.5** | — | `generateObject()` + Zod |
| 14 | `suggestTierStrategy()` | 現在スコアから次ティアへの具体的アドバイスを生成 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateText()` |
| 15 | `summarizeReviews()` | レシピの複数レビューを1文に要約 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateText()` |

#### D. 管理・品質管理（新規3関数）

| # | 関数 | 用途 | 初期モデル | 将来の最適化候補 | SDK メソッド |
|---|------|------|-----------|----------------|------------|
| 16 | `moderateReview()` | レビューのスパム/誹謗中傷をAI検出+フラグ付け | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateObject()` + Zod |
| 17 | `generateAwardNarrative()` | 月間アワード受賞理由ナラティブを自動生成 | **Claude Sonnet 4.5** | — | `generateText()` |
| 18 | `generateSalesInsight()` | 管理者向けに売上トレンドの自然言語サマリーを生成 | **Claude Sonnet 4.5** | Claude Haiku 4.5（コスト削減時） | `generateText()` |

#### 月間コスト試算（Claude Sonnet 4.5 統一、ユーザー1,000人/月想定）

| 区分 | 関数 | 呼出回数/月 | 入力tok | 出力tok | コスト概算 |
|------|------|-----------|---------|---------|-----------|
| **A. 配合エンジン** | | | | | |
| | generateStory | 3,000回 | ~500 | ~500 | ~$27.00 |
| | suggestRules | 200回 | ~300 | ~800 | ~$2.60 |
| | analyzeUserTaste | 500回 | ~800 | ~600 | ~$5.70 |
| | optimizeBaseRules | 1回（416件） | ~400 | ~300 | ~$0.10 |
| | generateSeasonalLayer | 1回/月 | ~500 | ~800 | ~$0.01 |
| | 小計 | | | | **~$35** |
| **B. ユーザー体験** | | | | | |
| | generateRecipeDescription | 300回 | ~600 | ~400 | ~$3.90 |
| | recommendCreators | 2,000回 | ~800 | ~600 | ~$15.00 |
| | recommendRecipes | 3,000回 | ~700 | ~500 | ~$16.50 |
| | interpretCheckinResponse | 500回 | ~300 | ~400 | ~$2.75 |
| | generateProductDescription | 100回 | ~600 | ~500 | ~$1.05 |
| | 小計 | | | | **~$39** |
| **C. クリエーター支援** | | | | | |
| | assistRecipeCreation | 200回 | ~800 | ~1,200 | ~$4.08 |
| | suggestTierStrategy | 100回 | ~500 | ~400 | ~$0.75 |
| | summarizeReviews | 200回 | ~1,000 | ~200 | ~$1.20 |
| | 小計 | | | | **~$6** |
| **D. 管理・品質管理** | | | | | |
| | moderateReview | 800回 | ~300 | ~200 | ~$3.20 |
| | generateAwardNarrative | 10回 | ~800 | ~500 | ~$0.11 |
| | generateSalesInsight | 4回 | ~2,000 | ~800 | ~$0.07 |
| | 小計 | | | | **~$3** |
| **全18関数合計** | | **~10,900回** | | | **~$83/月** |

**参考: 将来コスト最適化後（高頻度関数のみモデル切替）:**

| 関数 | 最適化モデル | コスト概算 | 削減率 |
|------|------------|-----------|--------|
| recommendCreators | Claude Haiku 4.5 | ~$3.00 | -80% |
| recommendRecipes | Claude Haiku 4.5 | ~$3.30 | -80% |
| moderateReview | Claude Haiku 4.5 | ~$0.64 | -80% |
| その他15関数 | Claude Sonnet 4.5（据置） | ~$65.00 | — |
| **最適化後合計** | | **~$72/月** | -13% |

※ 現在の GPT-4（レガシー）単一モデルで18関数を実行した場合: ~$500/月

### 11.5 実装設計

#### モデルレジストリ

**設計原則: モデルはいつでも切り替え可能にする。**
各関数が使うモデルを1ファイル（`models.ts`）で一元管理し、
関数側はモデル名を直接知らない。将来的にはDB/環境変数で動的切り替えも可能。

```typescript
// lib/ai/models.ts

import { type LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// ── 利用可能なモデル一覧 ─────────────────────────
// 新モデル追加時はここに1行追加するだけ
const AVAILABLE_MODELS = {
  'claude-sonnet-4.5': () => anthropic('claude-sonnet-4-5-20250929'),
  'claude-haiku-4.5':  () => anthropic('claude-haiku-4-5-20251001'),
  'gpt-4o':            () => openai('gpt-4o'),
  'gpt-4o-mini':       () => openai('gpt-4o-mini'),
  'gpt-4.1':           () => openai('gpt-4.1'),
  'gemini-2.5-flash':  () => google('gemini-2.5-flash'),
  'gemini-2.5-pro':    () => google('gemini-2.5-pro'),
} as const;

export type ModelKey = keyof typeof AVAILABLE_MODELS;

// ── 用途別モデル設定 ──────────────────────────────
// 切り替え時はここを変更するだけ。コード変更不要。
// 将来: DB or 環境変数から読み込む拡張が可能
type ModelConfig = { primary: ModelKey; fallback: ModelKey };

const MODEL_ASSIGNMENTS: Record<string, ModelConfig> = {
  // A. 配合エンジン
  story:            { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  structuredJson:   { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o-mini' },
  batch:            { primary: 'claude-sonnet-4.5', fallback: 'gemini-2.5-flash' },
  japaneseAnalysis: { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  premium:          { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  // B. ユーザー体験
  recipeDescription: { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  recommendation:    { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  checkinInterpret:  { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  productCopy:       { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  // C. クリエーター支援
  recipeAssist:      { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  creatorAdvice:     { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  reviewSummary:     { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  // D. 管理・品質管理
  moderation:        { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
  awardNarrative:    { primary: 'claude-sonnet-4.5', fallback: 'gpt-4o' },
  salesInsight:      { primary: 'claude-sonnet-4.5', fallback: 'claude-haiku-4.5' },
};

// ── 環境変数による上書き（オプション） ────────────
// AI_MODEL_STORY=gpt-4o のように環境変数で個別上書き可能
function resolveModel(purpose: string): { primary: LanguageModel; fallback: LanguageModel } {
  const config = MODEL_ASSIGNMENTS[purpose];
  const envOverride = process.env[`AI_MODEL_${purpose.toUpperCase()}`] as ModelKey | undefined;

  const primaryKey = envOverride ?? config.primary;
  const fallbackKey = config.fallback;

  return {
    primary: AVAILABLE_MODELS[primaryKey](),
    fallback: AVAILABLE_MODELS[fallbackKey](),
  };
}

export const AI_MODELS = {
  // A. 配合エンジン
  story:            resolveModel('story'),
  structuredJson:   resolveModel('structuredJson'),
  batch:            resolveModel('batch'),
  japaneseAnalysis: resolveModel('japaneseAnalysis'),
  premium:          resolveModel('premium'),
  // B. ユーザー体験
  recipeDescription: resolveModel('recipeDescription'),
  recommendation:    resolveModel('recommendation'),
  checkinInterpret:  resolveModel('checkinInterpret'),
  productCopy:       resolveModel('productCopy'),
  // C. クリエーター支援
  recipeAssist:      resolveModel('recipeAssist'),
  creatorAdvice:     resolveModel('creatorAdvice'),
  reviewSummary:     resolveModel('reviewSummary'),
  // D. 管理・品質管理
  moderation:        resolveModel('moderation'),
  awardNarrative:    resolveModel('awardNarrative'),
  salesInsight:      resolveModel('salesInsight'),
};
```

**切り替え方法（3段階）:**

| 方法 | 変更箇所 | 再デプロイ | ユースケース |
|------|---------|-----------|------------|
| コード変更 | `MODEL_ASSIGNMENTS` を編集 | 必要 | モデル世代の更新 |
| 環境変数 | `AI_MODEL_STORY=gpt-4o` を設定 | Vercelで即時 | A/Bテスト、障害時切替 |
| DB設定（将来） | 管理画面から変更 | 不要 | 運用中のリアルタイム切替 |

#### フォールバック付き実行ヘルパー

```typescript
// lib/ai/with-fallback.ts

import { generateText, generateObject, type LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';

type ModelConfig = {
  primary: LanguageModel;
  fallback: LanguageModel;
};

/**
 * プライマリモデルで実行し、失敗時にフォールバックモデルで再試行。
 * 両方失敗した場合は templateFn でテンプレート応答を返す。
 */
export async function withFallbackText(
  config: ModelConfig,
  params: { system: string; prompt: string; maxTokens: number; temperature: number },
  templateFn: () => string,
): Promise<string> {
  // 1st: primary
  try {
    const { text } = await generateText({ model: config.primary, ...params });
    return text;
  } catch (e) {
    console.warn(`[AI] Primary model failed: ${e}`);
  }

  // 2nd: fallback
  try {
    const { text } = await generateText({ model: config.fallback, ...params });
    return text;
  } catch (e) {
    console.warn(`[AI] Fallback model failed: ${e}`);
  }

  // 3rd: template
  return templateFn();
}

export async function withFallbackObject<T>(
  config: ModelConfig,
  params: { system: string; prompt: string; schema: ZodSchema<T>; temperature?: number },
  templateFn: () => T,
): Promise<T> {
  // 1st: primary
  try {
    const { object } = await generateObject({ model: config.primary, ...params });
    return object;
  } catch (e) {
    console.warn(`[AI] Primary model failed: ${e}`);
  }

  // 2nd: fallback
  try {
    const { object } = await generateObject({ model: config.fallback, ...params });
    return object;
  } catch (e) {
    console.warn(`[AI] Fallback model failed: ${e}`);
  }

  // 3rd: template
  return templateFn();
}
```

#### 移行後の ai-client.ts（主要関数のみ抜粋）

```typescript
// lib/ai-client.ts（移行後）

import { AI_MODELS } from '@/lib/ai/models';
import { withFallbackText, withFallbackObject } from '@/lib/ai/with-fallback';
import { z } from 'zod';

// ── Story Generation ─────────────────────────────────
// primary: Claude Sonnet 4.5 → fallback: GPT-4o → テンプレート
export async function generateStory(
  keywords: KeywordInfo[],
  flavors: FlavorInfo[],
  ratios: RatioInfo,
): Promise<string> {
  return withFallbackText(
    AI_MODELS.story,
    {
      system: 'あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。',
      prompt: buildStoryPrompt(keywords, flavors, ratios),
      maxTokens: 500,
      temperature: 0.8,
    },
    () => generateFallbackStory(keywords, ratios),
  );
}

// ── Rule Suggestion ──────────────────────────────────
// primary: Claude Sonnet 4.5 → fallback: GPT-4o-mini → テンプレート
const ruleSchema = z.array(z.object({
  nameEn: z.string(),
  noteType: z.enum(['TOP', 'MIDDLE', 'LAST']),
  weight: z.number().min(0).max(1),
}));

export async function suggestRules(
  keyword: string,
  flavors: { id: string; nameEn: string; noteType: NoteType }[],
): Promise<{ flavorId: string; weight: number; noteType: NoteType }[]> {
  const flavorList = flavors.map((f) => `${f.nameEn} (${f.noteType})`).join(', ');

  const result = await withFallbackObject(
    AI_MODELS.structuredJson,  // Claude Sonnet 4.5 → GPT-4o-mini fallback
    {
      system: 'あなたは香水の調香師です。',
      prompt:
        `キーワード「${keyword}」に関連する香料を以下のリストから選び、` +
        `各ノートから2〜4種を選んでweight(0.0〜1.0)を設定してください。\n\n` +
        `香料リスト: ${flavorList}`,
      schema: ruleSchema,
      temperature: 0.3,
    },
    () => generateFallbackSuggestion(flavors).map((f) => ({
      nameEn: flavors.find((fl) => fl.id === f.flavorId)?.nameEn ?? '',
      noteType: f.noteType,
      weight: f.weight,
    })),
  );

  const flavorMap = new Map(flavors.map((f) => [f.nameEn, f.id]));
  return result
    .filter((item) => flavorMap.has(item.nameEn))
    .map((item) => ({
      flavorId: flavorMap.get(item.nameEn)!,
      weight: Math.round(item.weight * 20) / 20,
      noteType: item.noteType,
    }));
}

// ── User Taste Analysis ──────────────────────────────
// primary: Claude Sonnet 4.5 → fallback: Claude Haiku 4.5 → 均一値
const tasteSchema = z.array(z.object({
  flavorNameEn: z.string(),
  affinity: z.number().min(-0.3).max(0.3),
}));

export async function analyzeUserTaste(
  profile: OnboardingData,
  flavors: { id: string; nameEn: string; nameJa: string; noteType: string }[],
): Promise<{ flavorId: string; affinity: number }[]> {
  const result = await withFallbackObject(
    AI_MODELS.japaneseAnalysis,  // Claude Sonnet 4.5 → Claude Haiku 4.5 fallback
    {
      system: 'あなたは調香の専門家です。ユーザーの嗜好データから香料への親和度を分析します。',
      prompt: buildTasteAnalysisPrompt(profile, flavors),
      schema: tasteSchema,
      temperature: 0.3,
    },
    () => flavors.map((f) => ({ flavorNameEn: f.nameEn, affinity: 0 })),
  );

  const flavorMap = new Map(flavors.map((f) => [f.nameEn, f.id]));
  return result
    .filter((r) => flavorMap.has(r.flavorNameEn))
    .map((r) => ({
      flavorId: flavorMap.get(r.flavorNameEn)!,
      affinity: r.affinity,
    }));
}
```

### 11.6 移行手順

| Phase | 内容 | 対象関数 | 期間 |
|-------|------|---------|------|
| **Phase A** | 基盤構築: `@ai-sdk/anthropic` 追加、models.ts / with-fallback.ts / prompts/ 作成 | — | 1日 |
| **Phase B** | 既存2関数を Claude Sonnet + `generateObject()` に移行 | #1 #2 | 1日 |
| **Phase C** | 配合エンジン系の新規関数を実装 | #3 #4 #5 #6 #7 | 2日 |
| **Phase D** | ユーザー体験系を実装 | #8 #9 #10 #11 #12 | 2日 |
| **Phase E** | クリエーター支援系を実装 | #13 #14 #15 | 1日 |
| **Phase F** | 管理・品質管理系を実装 | #16 #17 #18 | 1日 |

### 11.7 拡張AI関数の詳細仕様（#8〜#18）

#### #8 generateRecipeDescription() — レシピ説明文の自動生成

```typescript
// lib/ai/recipe-description.ts

const recipeDescriptionSchema = z.object({
  shortDescription: z.string(),  // 1行要約（50文字以内）
  fullDescription: z.string(),   // コンセプト文（200文字程度）
  targetScene: z.string(),       // 「夏のデートに」等のシーン提案
  keywords: z.array(z.string()), // SEO用キーワード3〜5個
});

export async function generateRecipeDescription(params: {
  recipeName: string;
  scene: string;
  mood: string;
  flavors: { nameJa: string; ratio: number; noteType: string }[];
}): Promise<z.infer<typeof recipeDescriptionSchema>> {
  return withFallbackObject(
    AI_MODELS.recipeDescription,
    {
      system: 'あなたは香水のコピーライターです。配合データから魅力的な説明文を作成します。',
      prompt: `レシピ「${params.recipeName}」の説明文を作成してください。
テーマ: ${params.scene} × ${params.mood}
配合: ${params.flavors.map(f => `${f.nameJa}(${f.noteType}) ${f.ratio}%`).join(', ')}`,
      schema: recipeDescriptionSchema,
      temperature: 0.7,
    },
    () => ({
      shortDescription: `${params.scene}の${params.mood}な香り`,
      fullDescription: `${params.recipeName}は、${params.scene}をテーマにした${params.mood}な香りです。`,
      targetScene: params.scene,
      keywords: [params.scene, params.mood],
    }),
  );
}
```

**トリガー:** クリエーターがレシピ保存時（自動生成ボタン）
**キャッシュ:** レシピ配合が変更されるまでキャッシュ保持

---

#### #9 recommendCreators() — クリエーター推薦

```typescript
// lib/ai/recommend-creators.ts

const creatorRecommendationSchema = z.array(z.object({
  creatorId: z.string(),
  matchScore: z.number().min(0).max(100),
  reason: z.string(),  // 「あなたの好むフローラル系を得意とするクリエーターです」
}));

export async function recommendCreators(params: {
  userTasteProfile: ComputedTasteProfile;
  creators: { id: string; name: string; styleDescription: string; topRecipes: string[] }[];
  limit: number;
}): Promise<z.infer<typeof creatorRecommendationSchema>> {
  return withFallbackObject(
    AI_MODELS.recommendation,
    {
      system: 'あなたはフレグランスのコンシェルジュです。ユーザーの好みに合うクリエーターを推薦します。',
      prompt: `ユーザー嗜好:
好みの系統: ${params.userTasteProfile.flavorAffinities.filter(f => f.affinity > 0.1).map(f => f.flavorId).join(', ')}
嗜好軸: 重さ=${params.userTasteProfile.currentMoodModifier?.mood ?? '通常'}

クリエーター一覧:
${params.creators.map(c => `- ${c.name}: ${c.styleDescription} (代表作: ${c.topRecipes.join(', ')})`).join('\n')}

上位${params.limit}名を推薦してください。`,
      schema: creatorRecommendationSchema,
      temperature: 0.3,
    },
    () => params.creators.slice(0, params.limit).map(c => ({
      creatorId: c.id, matchScore: 50, reason: '人気のクリエーターです',
    })),
  );
}
```

**トリガー:** ホーム画面表示時、クリエーター一覧画面
**キャッシュ:** ユーザー嗜好更新まで1時間キャッシュ

---

#### #10 recommendRecipes() — レシピ推薦

```typescript
// lib/ai/recommend-recipes.ts

const recipeRecommendationSchema = z.array(z.object({
  recipeId: z.string(),
  matchScore: z.number().min(0).max(100),
  reason: z.string(),
  highlightFlavor: z.string(),  // 推薦理由のキーとなる香料名
}));

export async function recommendRecipes(params: {
  userTasteProfile: ComputedTasteProfile;
  purchaseHistory: { recipeId: string; rating?: number }[];
  candidateRecipes: { id: string; name: string; creator: string; scene: string; mood: string; topFlavors: string[] }[];
  currentMood?: string;
  limit: number;
}): Promise<z.infer<typeof recipeRecommendationSchema>> {
  return withFallbackObject(
    AI_MODELS.recommendation,
    {
      system: 'あなたはフレグランスのレコメンドエンジンです。ユーザーの嗜好・購入履歴・現在の気分から最適なレシピを提案します。',
      prompt: `ユーザー情報:
嗜好: ${JSON.stringify(params.userTasteProfile.flavorAffinities.filter(f => Math.abs(f.affinity) > 0.1))}
購入済み: ${params.purchaseHistory.length}件
${params.currentMood ? `今の気分: ${params.currentMood}` : ''}

候補レシピ（${params.candidateRecipes.length}件）:
${params.candidateRecipes.map(r => `- ${r.name} by ${r.creator} [${r.scene}×${r.mood}] 主要: ${r.topFlavors.join(',')}`).join('\n')}

上位${params.limit}件を推薦。購入済みレシピは除外。`,
      schema: recipeRecommendationSchema,
      temperature: 0.3,
    },
    () => params.candidateRecipes.slice(0, params.limit).map(r => ({
      recipeId: r.id, matchScore: 50, reason: '人気のレシピです', highlightFlavor: r.topFlavors[0] ?? '',
    })),
  );
}
```

**トリガー:** 配合リクエスト画面「人気のレシピ」セクション、ホーム画面
**キャッシュ:** 気分チェックイン or 嗜好更新まで30分キャッシュ

---

#### #11 interpretCheckinResponse() — チェックイン応答の解釈

```typescript
// lib/ai/checkin-interpret.ts

const checkinInterpretSchema = z.object({
  relatedFamilies: z.array(z.enum(['FLORAL', 'CITRUS', 'WOODY', 'ORIENTAL', 'FRESH', 'GOURMAND'])),
  axesAdjustments: z.object({
    weight: z.number().min(-0.3).max(0.3).optional(),
    sweetness: z.number().min(-0.3).max(0.3).optional(),
    temperature: z.number().min(-0.3).max(0.3).optional(),
    formality: z.number().min(-0.3).max(0.3).optional(),
    intensity: z.number().min(-0.3).max(0.3).optional(),
  }),
  summary: z.string(),  // 「新しいウッディ系への関心が芽生えています」
});

export async function interpretCheckinResponse(params: {
  channel: 'CHECKIN_DISCOVERY' | 'CHECKIN_SEASONAL';
  userMessage: string;
  currentProfile: ComputedTasteProfile;
}): Promise<z.infer<typeof checkinInterpretSchema>> {
  return withFallbackObject(
    AI_MODELS.checkinInterpret,
    {
      system: `あなたはフレグランスカウンセラーです。
ユーザーの自由記述から嗜好の変化を読み取り、プロファイルの調整値を算出します。
変化が小さい場合は0を返してください。大きな変化でも±0.3を超えないこと。`,
      prompt: `ユーザーの回答: 「${params.userMessage}」
現在の嗜好傾向: ${JSON.stringify(params.currentProfile.flavorAffinities.filter(f => Math.abs(f.affinity) > 0.1))}`,
      schema: checkinInterpretSchema,
      temperature: 0.3,
    },
    () => ({
      relatedFamilies: [],
      axesAdjustments: {},
      summary: '回答を記録しました',
    }),
  );
}
```

**トリガー:** マイクロチェックインで自由記述が送信された時
**注意:** 調整値は ±0.3 にクランプし、急激な変化を防止

---

#### #12 generateProductDescription() — 商品説明文の自動生成

```typescript
// lib/ai/product-description.ts

export async function generateProductDescription(params: {
  recipeName: string;
  creatorName: string;
  concept: string;
  flavors: { nameJa: string; ratio: number; noteType: string }[];
  price30ml: number;
  price50ml: number;
}): Promise<string> {
  return withFallbackText(
    AI_MODELS.productCopy,
    {
      system: `あなたはラグジュアリーブランドのコピーライターです。
香水の商品説明文を作成します。以下を含めてください:
1. 香りの第一印象（1文）
2. 時間経過による変化の描写（2-3文）
3. おすすめのシーン（1文）
4. クリエーターの想い（1文）
全体で200-300文字。`,
      prompt: `レシピ: ${params.recipeName} by ${params.creatorName}
コンセプト: ${params.concept}
TOP: ${params.flavors.filter(f => f.noteType === 'TOP').map(f => `${f.nameJa} ${f.ratio}%`).join(', ')}
MIDDLE: ${params.flavors.filter(f => f.noteType === 'MIDDLE').map(f => `${f.nameJa} ${f.ratio}%`).join(', ')}
LAST: ${params.flavors.filter(f => f.noteType === 'LAST').map(f => `${f.nameJa} ${f.ratio}%`).join(', ')}`,
      maxTokens: 500,
      temperature: 0.7,
    },
    () => `${params.recipeName} — ${params.creatorName}が手がけたオリジナルフレグランスです。`,
  );
}
```

**トリガー:** EC出品時の「説明文を自動生成」ボタン
**編集可能:** 生成後にクリエーターが自由に編集

---

#### #13 assistRecipeCreation() — レシピ作成AIアシスト

```typescript
// lib/ai/recipe-assist.ts

const recipeProposalSchema = z.array(z.object({
  proposalName: z.string(),
  concept: z.string(),
  flavors: z.array(z.object({
    flavorNameEn: z.string(),
    noteType: z.enum(['TOP', 'MIDDLE', 'LAST']),
    ratio: z.number().min(1).max(50),
  })),
  totalTop: z.number(),
  totalMiddle: z.number(),
  totalLast: z.number(),
  reasoning: z.string(),
})).min(3).max(3);

export async function assistRecipeCreation(params: {
  theme: string;        // 「夏のデート向け」等
  creatorStyle?: CreatorStyle;
  existingRecipes?: { name: string; topFlavors: string[] }[];
  availableFlavors: { nameEn: string; nameJa: string; noteType: string }[];
}): Promise<z.infer<typeof recipeProposalSchema>> {
  return withFallbackObject(
    AI_MODELS.recipeAssist,
    {
      system: `あなたはプロの調香師です。テーマに基づき3つの異なるアプローチの配合案を提案します。
各提案は合計100%になること。既存レシピと被らないよう独自性を出してください。
${params.creatorStyle ? `クリエーターのスタイル: ${params.creatorStyle.description}` : ''}`,
      prompt: `テーマ: ${params.theme}
利用可能な香料: ${params.availableFlavors.map(f => `${f.nameEn}(${f.nameJa}, ${f.noteType})`).join(', ')}
${params.existingRecipes?.length ? `既存レシピ: ${params.existingRecipes.map(r => r.name).join(', ')}（差別化すること）` : ''}

3つの配合案を提案してください。`,
      schema: recipeProposalSchema,
      temperature: 0.7,
    },
    () => [/* 3 default balanced proposals */],
  );
}
```

**トリガー:** レシピ編集画面の「AIアシスト」ボタン
**表示:** 3案をカード表示、タップで配合エディタに反映

---

#### #14 suggestTierStrategy() — ティアアップ戦略提案

```typescript
// lib/ai/tier-strategy.ts

export async function suggestTierStrategy(params: {
  currentTier: string;
  nextTier: string;
  currentScore: { rating: number; repeatRate: number; favorites: number; recipeSales: number; reviews: number };
  requiredScore: number;
  gap: number;
}): Promise<string> {
  return withFallbackText(
    AI_MODELS.creatorAdvice,
    {
      system: 'あなたはクリエーター育成のアドバイザーです。具体的で実行可能なアドバイスを3つ以内で簡潔に提案します。',
      prompt: `現在: ${params.currentTier}（スコア: ${JSON.stringify(params.currentScore)}）
目標: ${params.nextTier}（必要スコア: ${params.requiredScore}、あと${params.gap}ポイント）

最も効果的な改善ポイントと具体的アクションを提案してください。`,
      maxTokens: 300,
      temperature: 0.5,
    },
    () => `${params.nextTier}まであと${params.gap}ポイントです。レシピの公開数を増やし、レビューを促進しましょう。`,
  );
}
```

**トリガー:** クリエーターダッシュボードのティア表示セクション
**キャッシュ:** スコア変動まで24時間キャッシュ

---

#### #15 summarizeReviews() — レビュー要約

```typescript
// lib/ai/review-summary.ts

export async function summarizeReviews(params: {
  recipeName: string;
  reviews: { rating: number; text: string; createdAt: string }[];
}): Promise<string> {
  return withFallbackText(
    AI_MODELS.reviewSummary,
    {
      system: 'レビューを1-2文に要約してください。肯定・否定の両面を公平に。数値は含めず、感性的な表現で。',
      prompt: `レシピ「${params.recipeName}」のレビュー（${params.reviews.length}件）:
${params.reviews.map(r => `★${r.rating}: ${r.text}`).join('\n')}`,
      maxTokens: 150,
      temperature: 0.3,
    },
    () => `${params.reviews.length}件のレビューがあります。平均★${(params.reviews.reduce((s, r) => s + r.rating, 0) / params.reviews.length).toFixed(1)}`,
  );
}
```

**トリガー:** レシピ詳細画面のレビューセクション（レビュー3件以上で表示）
**キャッシュ:** 新規レビュー追加まで保持

---

#### #16 moderateReview() — レビューモデレーション

```typescript
// lib/ai/moderation.ts

const moderationSchema = z.object({
  isApproved: z.boolean(),
  flags: z.array(z.enum([
    'SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'FAKE_POSITIVE', 'FAKE_NEGATIVE',
    'OFF_TOPIC', 'PERSONAL_INFO', 'PROMOTIONAL',
  ])),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export async function moderateReview(params: {
  reviewText: string;
  rating: number;
  reviewerHistory: { reviewCount: number; avgRating: number; flagCount: number };
  recipeName: string;
}): Promise<z.infer<typeof moderationSchema>> {
  return withFallbackObject(
    AI_MODELS.moderation,
    {
      system: `あなたはコンテンツモデレーターです。フレグランスレビューを審査します。
以下に該当する場合はフラグを立ててください:
- スパム（無意味な繰り返し、関係のない内容）
- 嫌がらせ（個人攻撃、差別的表現）
- やらせ（不自然に高評価/低評価、具体性のない絶賛/酷評）
- 個人情報（電話番号、住所等）
- 宣伝（外部サイトへの誘導）
判断に迷う場合は承認（isApproved: true）としてください。`,
      prompt: `レビュー: 「${params.reviewText}」
評価: ★${params.rating}
対象レシピ: ${params.recipeName}
投稿者: レビュー${params.reviewerHistory.reviewCount}件, 平均★${params.reviewerHistory.avgRating}, 過去フラグ${params.reviewerHistory.flagCount}件`,
      schema: moderationSchema,
      temperature: 0.1,
    },
    () => ({ isApproved: true, flags: [], confidence: 0, reason: 'AI審査スキップ' }),
  );
}
```

**トリガー:** レビュー投稿時に自動実行
**運用:** `confidence >= 0.8` かつ `isApproved: false` → 自動非表示 + 管理者通知
　　　 `confidence < 0.8` → 管理者の手動レビューキューに追加
**重要:** AI判定は最終判断ではなく、フラグ付けまで。最終判断は管理者

---

#### #17 generateAwardNarrative() — アワード受賞理由生成

```typescript
// lib/ai/award-narrative.ts

export async function generateAwardNarrative(params: {
  awardName: string;     // 「今月のベストレシピ」
  recipeName: string;
  creatorName: string;
  metrics: { salesCount: number; avgRating: number; reviewCount: number };
  topReviewExcerpt?: string;
}): Promise<string> {
  return withFallbackText(
    AI_MODELS.awardNarrative,
    {
      system: '受賞理由を3文程度で作成。具体的な実績に触れつつ、クリエーターの創造性を称える温かいトーンで。',
      prompt: `アワード: ${params.awardName}
受賞レシピ: 「${params.recipeName}」 by ${params.creatorName}
実績: 販売${params.metrics.salesCount}件, ★${params.metrics.avgRating}, レビュー${params.metrics.reviewCount}件
${params.topReviewExcerpt ? `ユーザーの声: 「${params.topReviewExcerpt}」` : ''}`,
      maxTokens: 200,
      temperature: 0.7,
    },
    () => `${params.creatorName}さんの「${params.recipeName}」が${params.awardName}を受賞しました。`,
  );
}
```

**トリガー:** 月次アワード確定バッチ実行時
**表示:** アワード詳細画面、クリエーターダッシュボード、プッシュ通知

---

#### #18 generateSalesInsight() — 売上インサイト生成

```typescript
// lib/ai/sales-insight.ts

export async function generateSalesInsight(params: {
  period: string;  // '2026-02'
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    topRecipes: { name: string; sales: number; creator: string }[];
    topKeywords: { word: string; count: number }[];
    categoryBreakdown: { category: string; ratio: number }[];
    momGrowth: number;  // 前月比成長率
    newUsers: number;
    repeatRate: number;
  };
}): Promise<string> {
  return withFallbackText(
    AI_MODELS.salesInsight,
    {
      system: `あなたはビジネスアナリストです。ECプラットフォームの月次データから
経営者向けのインサイトサマリーを作成します。
箇条書き5項目以内、各項目1-2文。数値を含め、トレンドと示唆を述べてください。`,
      prompt: `期間: ${params.period}
注文数: ${params.metrics.totalOrders}件（前月比${params.metrics.momGrowth > 0 ? '+' : ''}${params.metrics.momGrowth}%）
売上: ¥${params.metrics.totalRevenue.toLocaleString()}
新規ユーザー: ${params.metrics.newUsers}人
リピート率: ${params.metrics.repeatRate}%

トップレシピ:
${params.metrics.topRecipes.map((r, i) => `${i + 1}. ${r.name} by ${r.creator} (${r.sales}件)`).join('\n')}

人気キーワード: ${params.metrics.topKeywords.map(k => `${k.word}(${k.count})`).join(', ')}

カテゴリ構成: ${params.metrics.categoryBreakdown.map(c => `${c.category}=${c.ratio}%`).join(', ')}`,
      maxTokens: 500,
      temperature: 0.3,
    },
    () => `${params.period}の注文数は${params.metrics.totalOrders}件でした。`,
  );
}
```

**トリガー:** 管理者ダッシュボード表示時（月次データ確定後）
**キャッシュ:** 月次データ更新まで保持

---

#### プロンプト管理の一元化

18関数のシステムプロンプトが散在しないよう、テンプレートファイルで一元管理する。

```
lib/ai/
├── models.ts              # モデルレジストリ
├── with-fallback.ts       # フォールバック実行ヘルパー
├── prompts/               # プロンプトテンプレート一元管理
│   ├── story.ts           # #1 ストーリー生成
│   ├── rules.ts           # #2 ルール提案
│   ├── base-rules.ts      # #3 ベースルール生成
│   ├── taste-analysis.ts  # #4 嗜好分析
│   ├── calibration.ts     # #5 キャリブレーション
│   ├── optimization.ts    # #6 自動最適化
│   ├── seasonal.ts        # #7 季節レイヤー
│   ├── recipe-desc.ts     # #8 レシピ説明文
│   ├── recommend.ts       # #9-10 推薦（クリエーター/レシピ共通）
│   ├── checkin.ts         # #11 チェックイン解釈
│   ├── product-copy.ts    # #12 商品説明文
│   ├── recipe-assist.ts   # #13 レシピ作成アシスト
│   ├── tier-strategy.ts   # #14 ティア戦略
│   ├── review-summary.ts  # #15 レビュー要約
│   ├── moderation.ts      # #16 モデレーション
│   ├── award.ts           # #17 アワードナラティブ
│   └── sales-insight.ts   # #18 売上インサイト
└── functions/             # AI関数の実装
    ├── story.ts
    ├── rules.ts
    ├── ...
    └── sales-insight.ts
```

### 11.8 モデル選定の判断基準

将来的にモデルの変更・追加が発生する場合の選定基準。

| 基準 | 重み | 評価ポイント |
|------|------|------------|
| 日本語品質 | ★★★ | ストーリー生成・嗜好分析で特に重要 |
| 構造化出力の安定性 | ★★★ | ルール/配合JSON生成の信頼性 |
| コスト | ★★☆ | 月間コストがユーザー数に比例するため |
| レイテンシ | ★★☆ | UX直結（ストーリー生成は体感に影響） |
| バッチAPI対応 | ★☆☆ | 一括処理/月次バッチで重要 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-14 | 初版作成。モード3ハイブリッド型アーキテクチャ設計 |
| 2026-02-17 | セクション3.4「ベースルール蓄積方法」追加。4フェーズ（AI一括生成→専門家レビュー→管理者画面→自動最適化）の詳細設計、生成スクリプト、検証スクリプト、監査ログテーブル、学習バッチを記載 |
| 2026-02-17 | Phase 2.5「AIレシピ提案→Shimizuフィードバックループ」追加。構造化ギャップ理由（GapReason型）、自動補正ロジック、反復収束判定、キャリブレーションUI仕様を記載 |
| 2026-02-17 | セクション3.7「積層型ルールアーキテクチャ」追加。上書きから積層方式に転換、5レイヤー構成、合算計算、季節コンテキスト補正、レイヤー分解表示を記載 |
| 2026-02-17 | セクション10「ユーザー嗜好プロファイリング（リビングプロファイル）」追加。3チャネル収集（オンボーディング/マイクロチェックイン/暗黙的フィードバック）、時間減衰合算、気分補正、DBスキーマを記載 |
| 2026-02-17 | セクション11「AIプロバイダー戦略（マルチモデル設計）」追加。3社比較（OpenAI/Anthropic/Google）、用途別モデル割当、モデルレジストリ、フォールバック実装、月間コスト試算を記載 |
| 2026-02-17 | セクション11.4-11.7 拡張。AI関数を7→18に拡大（B.ユーザー体験5関数、C.クリエーター支援3関数、D.管理品質3関数）。全関数の型定義・プロンプト・トリガー・キャッシュ戦略・プロンプト一元管理ディレクトリ構成を記載 |

---

*最終更新: 2026年2月17日*
