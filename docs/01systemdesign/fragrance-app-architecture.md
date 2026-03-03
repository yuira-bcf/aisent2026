# 香り生成アプリ アーキテクチャ設計書

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [全体アーキテクチャ](#2-全体アーキテクチャ)
3. [事前準備データ定義](#3-事前準備データ定義)
4. [Layer 1：ルールエンジン（Laravel）](#4-layer-1ルールエンジンlaravel)
5. [Layer 2：配合生成MLモデル（FastAPI）](#5-layer-2配合生成mlモデルfastapi)
6. [Layer 3：パーソナライズエンジン（FastAPI）](#6-layer-3パーソナライズエンジンfastapi)
7. [データベース設計](#7-データベース設計)
8. [API設計](#8-api設計)
9. [モデル学習パイプライン](#9-モデル学習パイプライン)
10. [インフラ構成](#10-インフラ構成)
11. [Mecrear AIエージェントへの展開戦略](#11-mecrear-aiエージェントへの展開戦略)
12. [フレグランスマップ機能](#12-フレグランスマップ機能)

---

## 1. プロジェクト概要

### 1.1 背景

株式会社キャライノベイトが提供するAISCENT（アイセント）の後継として、ユーザーの希望（季節・感覚・フリーワード）からAIが最適なフレグランス配合レシピを生成するアプリケーションを開発する。

### 1.2 設計方針

ルールベース、MLモデル、メタ学習（パーソナライズ）の3層を初期段階からフル実装する。調香師のレシピデータ・香料相性データ等の必要データは事前に準備する前提とし、LLMへのフォールバックに依存しない自前推論モデルで構築する。

### 1.3 3層複合が必要な理由

| 層 | 単独での限界 | 複合での役割 |
|---|---|---|
| ルールのみ | 「さわやか」等の抽象入力に対応不可。パターン爆発 | 安全制約のGate Keeper。禁止組合せや比率制約の強制 |
| MLモデルのみ | 禁止組合せ等の絶対制約を保証できない | ルールが通した候補から最適配合を予測 |
| メタ学習のみ | ベースとなるレシピがなければ調整対象がない | ユーザー個人の嗜好に合わせた微調整 |

### 1.4 性能目標

| 項目 | 目標値 |
|---|---|
| レシピ生成レイテンシ | 100-300ms（LLM依存時は2-5秒） |
| API呼び出し費用 | ほぼゼロ（自前推論） |
| パーソナライズ精度 | フィードバック5件以上で嗜好反映 |

---

## 2. 全体アーキテクチャ

### 2.1 3層処理フロー

```
ユーザー入力（季節・感覚・フリーワード）
         │
    ┌────▼────┐
    │ Layer 1  │  ルールエンジン（Gate Keeper）
    │ Laravel  │  - 香料相性の禁止ルール
    │          │  - トップ/ミドル/ラスト比率の基本制約
    │          │  - 季節×感覚 → 香料カテゴリのマッピング
    └────┬────┘
         │ 制約付き候補香料リスト
    ┌────▼────┐
    │ Layer 2  │  MLモデル（配合最適化）
    │ FastAPI  │  - 候補香料から最適な配合比率を予測
    │          │  - 学習データ: 調香師レシピ + ユーザー評価
    │          │  - GradientBoosting（MultiOutput）
    └────┬────┘
         │ 配合レシピ案
    ┌────▼────┐
    │ Layer 3  │  メタモデル（パーソナライズ）
    │ FastAPI  │  - ユーザー履歴から嗜好を学習
    │          │  - NMF（非負値行列分解）による協調フィルタリング
    │          │  - コールドスタートはペルソナマッチングで対応
    └────┬────┘
         │
    最終レシピ出力
```

### 2.2 システム構成

```
┌────────────────────────────────────────────────────┐
│                  Docker Compose                     │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Laravel  │  │ FastAPI  │  │ FastAPI          │  │
│  │ :8000    │  │ :8001    │  │ :8002            │  │
│  │          │  │          │  │                  │  │
│  │ Layer 1  │→│ Layer 2  │→│ Layer 3          │  │
│  │ ルール    │  │ 配合生成  │  │ パーソナライズ    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │
│       │             │             │                 │
│       └──────┬──────┴──────┬──────┘                 │
│              ▼             ▼                        │
│  ┌──────────────┐  ┌─────────────┐                  │
│  │ PostgreSQL   │  │ Redis       │                  │
│  │ :5432        │  │ :6379       │                  │
│  └──────────────┘  └─────────────┘                  │
└────────────────────────────────────────────────────┘
```

### 2.3 技術スタック

| レイヤー | 技術 | 役割 |
|---------|------|------|
| フロントエンド | React（or Vue.js） | 入力UI・レシピ表示・フィードバック収集 |
| API Gateway | PHP Laravel | 認証・ルールエンジン・リクエスト制御 |
| ML推論 | Python FastAPI | Layer 2/3 のMLモデル推論 |
| テキスト埋込 | sentence-transformers | フリーワード → 384次元ベクトル変換 |
| DB | PostgreSQL | 全データ管理 |
| キャッシュ | Redis | 推論結果キャッシュ・セッション管理 |

---

## 3. 事前準備データ定義

### 3.1 Layer 1 用データ

#### ① 香料マスタ（50-100種）

| フィールド | 型 | 説明 | 例 |
|-----------|---|------|---|
| name | VARCHAR | 和名 | レモン |
| name_en | VARCHAR | 英名 | Lemon |
| note_type | ENUM | トップ/ミドル/ラスト | top |
| category | VARCHAR | 香りカテゴリ | citrus |
| volatility | DECIMAL | 揮発性 0.00-1.00 | 0.90 |
| intensity | DECIMAL | 香りの強さ 0.00-1.00 | 0.60 |

#### ② 禁止組み合わせテーブル

化学的に相性が悪い、または混合すると不快な香りになるペア。調香師の知見から事前定義。

#### ③ 季節×感覚マッピング（24パターン）

4季節 × 6感覚（さわやか/まろやか/ナチュラル/陽気/優雅/高級）の組み合わせごとに推奨香料カテゴリを定義。

```
例：
  春 × さわやか  → [citrus, green, floral_light]
  夏 × さわやか  → [citrus, marine, mint]
  秋 × 高級     → [amber, sandalwood, leather]
  冬 × まろやか  → [vanilla, cinnamon, musk]
```

### 3.2 Layer 2 用データ

#### ④ 調香師レシピデータ（300件以上が理想）

| フィールド | 説明 |
|-----------|------|
| 入力（季節・感覚・コンセプト） | レシピの意図・テーマ |
| 出力（香料×配合比率） | 各香料の配合パーセンテージ |
| 品質スコア | 調香師による5段階評価 |

#### ⑤ 香料ペア相性スコア

全香料ペアの相性を -1.0〜1.0 で数値化。50種の場合 50×49/2 = 1,225ペア。

```
例：
  レモン × ベルガモット = 0.9（非常に相性良い）
  ローズ × サンダルウッド = 0.8
  ミント × バニラ = -0.3（相性が悪い）
```

### 3.3 Layer 3 用データ

#### ⑥ ペルソナ別嗜好データ（20-30パターン）

コールドスタート問題（新規ユーザーのフィードバックがゼロ）を解消するための初期シードデータ。

```
例：
  朝型フレッシュ派:
    好み: citrus(0.9), green(0.8), marine(0.7)
    苦手: oriental(-0.3), sweet(-0.5)
    
  夜のエレガント派:
    好み: rose(0.9), jasmine(0.8), oriental(0.7)
    苦手: citrus(-0.2), marine(-0.4)
```

初回利用時の簡単なアンケート（3-5問）でペルソナを判定し、嗜好ベクトルの初期値として使用。

---

## 4. Layer 1：ルールエンジン（Laravel）

### 4.1 クラス設計

```php
// app/Services/Fragrance/RuleEngine.php

class RuleEngine
{
    private array $ingredients;
    private array $prohibitedPairs;

    /**
     * 入力条件から候補香料リストを生成
     */
    public function filterCandidates(
        string $season,
        string $feeling,
        ?string $freeword = null
    ): FilteredResult {
        // Step 1: 季節×感覚 → 香料カテゴリマッピング
        $categories = $this->mapToCategories($season, $feeling);
        
        // Step 2: カテゴリに属する香料を取得
        $candidates = $this->ingredients
            ->filter(fn($i) => in_array($i->category, $categories));
        
        // Step 3: ノート比率の基本制約を適用
        $balanced = $this->applyNoteBalance($candidates);
        
        // Step 4: 禁止組み合わせを除外
        $safe = $this->removeProhibitedPairs($balanced);
        
        return new FilteredResult(
            candidates: $safe,
            constraints: [
                'top_ratio'    => [0.20, 0.35],
                'middle_ratio' => [0.30, 0.50],
                'last_ratio'   => [0.20, 0.35],
                'max_ingredients' => 6,
            ],
            context: [
                'season'  => $season,
                'feeling' => $feeling,
                'freeword' => $freeword,
            ]
        );
    }

    /**
     * 季節×感覚 → 推奨カテゴリの取得
     */
    private function mapToCategories(
        string $season, 
        string $feeling
    ): array {
        $map = [
            '春' => [
                'さわやか'   => ['citrus', 'green', 'floral_light'],
                'まろやか'   => ['floral_rich', 'powder', 'musk'],
                'ナチュラル' => ['green', 'herbal', 'wood_light'],
                '陽気'       => ['citrus', 'fruity', 'floral_light'],
                '優雅'       => ['floral_rich', 'rose', 'musk'],
                '高級'       => ['rose', 'jasmine', 'sandalwood'],
            ],
            '夏' => [
                'さわやか'   => ['citrus', 'marine', 'mint'],
                'まろやか'   => ['coconut', 'vanilla_light', 'floral_light'],
                'ナチュラル' => ['green', 'herbal', 'aqua'],
                '陽気'       => ['citrus', 'tropical', 'fruity'],
                '優雅'       => ['jasmine', 'ylang', 'marine'],
                '高級'       => ['neroli', 'tuberose', 'vetiver'],
            ],
            '秋' => [
                'さわやか'   => ['citrus', 'green', 'apple'],
                'まろやか'   => ['cinnamon', 'vanilla', 'amber'],
                'ナチュラル' => ['wood', 'moss', 'herbal'],
                '陽気'       => ['fruity', 'spice_light', 'citrus'],
                '優雅'       => ['rose', 'patchouli', 'amber'],
                '高級'       => ['oud', 'leather', 'sandalwood'],
            ],
            '冬' => [
                'さわやか'   => ['mint', 'eucalyptus', 'citrus'],
                'まろやか'   => ['vanilla', 'cinnamon', 'musk'],
                'ナチュラル' => ['cedar', 'pine', 'moss'],
                '陽気'       => ['spice', 'citrus', 'ginger'],
                '優雅'       => ['iris', 'violet', 'cashmere'],
                '高級'       => ['oud', 'amber', 'incense'],
            ],
        ];

        return $map[$season][$feeling] ?? ['floral_light', 'citrus'];
    }

    /**
     * 各ノートタイプが最低2種含まれることを保証
     */
    private function applyNoteBalance(Collection $candidates): Collection
    {
        $top    = $candidates->filter(fn($i) => $i->note === 'top');
        $middle = $candidates->filter(fn($i) => $i->note === 'middle');
        $last   = $candidates->filter(fn($i) => $i->note === 'last');

        if ($top->count() < 2) {
            $top = $this->supplementNote('top', $candidates);
        }
        if ($middle->count() < 2) {
            $middle = $this->supplementNote('middle', $candidates);
        }
        if ($last->count() < 2) {
            $last = $this->supplementNote('last', $candidates);
        }

        return $top->merge($middle)->merge($last);
    }

    /**
     * 禁止組み合わせの除外
     */
    private function removeProhibitedPairs(Collection $candidates): Collection
    {
        $ids = $candidates->pluck('id')->toArray();
        
        foreach ($this->prohibitedPairs as $pair) {
            if (in_array($pair->ingredient_a_id, $ids) 
                && in_array($pair->ingredient_b_id, $ids)) {
                // 優先度の低い方を除外
                $candidates = $candidates->reject(
                    fn($i) => $i->id === $pair->lower_priority_id
                );
            }
        }
        
        return $candidates;
    }
}
```

---

## 5. Layer 2：配合生成MLモデル（FastAPI）

### 5.1 モデル設計

Strategy Patternで抽象化し、将来のモデル差し替えに対応。データが事前に揃っている前提のため、初期からMLモデルで稼働する。

```python
# app/models/blend_model.py

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from dataclasses import dataclass

@dataclass
class BlendInput:
    """Layer 1から受け取る入力"""
    candidate_ids: list[int]
    candidate_features: np.ndarray    # 各香料の特徴量
    season_encoded: np.ndarray        # 季節 one-hot (4,)
    feeling_encoded: np.ndarray       # 感覚 one-hot (6,)
    freeword_embedding: np.ndarray    # フリーワード埋込 (384,)
    constraints: dict


class BlendModel:
    """配合比率予測モデル"""
    
    def __init__(self):
        self.model = MultiOutputRegressor(
            GradientBoostingRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1
            )
        )
        self.compatibility_matrix = None

    def train(self, recipes_df):
        """
        recipes_df の構成:
          特徴量: season(one-hot), feeling(one-hot), freeword_emb(384d)
          ターゲット: 各香料の配合比率（0-100, 未使用は0）
        """
        X = recipes_df[self.feature_columns].values
        y = recipes_df[self.ingredient_columns].values
        self.model.fit(X, y)

    def predict(self, blend_input: BlendInput) -> dict:
        # 特徴量を結合
        features = np.concatenate([
            blend_input.season_encoded,
            blend_input.feeling_encoded,
            blend_input.freeword_embedding,
            blend_input.candidate_features.mean(axis=0),
        ]).reshape(1, -1)
        
        # 全香料の比率を予測
        raw_ratios = self.model.predict(features)[0]
        
        # 候補香料以外をゼロに
        mask = np.zeros_like(raw_ratios)
        for idx in blend_input.candidate_ids:
            mask[idx] = 1
        raw_ratios *= mask
        
        # 制約適用 + 正規化
        ratios = self._apply_constraints(raw_ratios, blend_input.constraints)
        
        # 相性スコアで微調整
        ratios = self._adjust_by_compatibility(ratios, blend_input.candidate_ids)
        
        return self._format_output(ratios, blend_input)

    def _apply_constraints(self, ratios, constraints):
        """ノート比率制約を満たすよう調整"""
        ratios = np.maximum(ratios, 0)
        
        for note_type, (min_r, max_r) in [
            ('top', constraints['top_ratio']),
            ('middle', constraints['middle_ratio']),
            ('last', constraints['last_ratio']),
        ]:
            note_indices = self.note_type_indices[note_type]
            note_sum = ratios[note_indices].sum()
            total = ratios.sum() or 1
            
            current_ratio = note_sum / total
            if current_ratio < min_r:
                boost = min_r / (current_ratio or 0.01)
                ratios[note_indices] *= boost
            elif current_ratio > max_r:
                ratios[note_indices] *= max_r / current_ratio
        
        # 100%に正規化
        ratios = (ratios / ratios.sum()) * 100
        return ratios

    def _adjust_by_compatibility(self, ratios, candidate_ids):
        """相性行列で配合を微調整"""
        active = [(i, ratios[i]) for i in candidate_ids if ratios[i] > 0]
        
        for i, ratio_i in active:
            compat_score = 0
            for j, ratio_j in active:
                if i != j:
                    compat_score += self.compatibility_matrix[i][j] * ratio_j
            adjustment = 1.0 + (compat_score * 0.05)
            ratios[i] *= np.clip(adjustment, 0.9, 1.1)
        
        ratios = (ratios / ratios.sum()) * 100
        return ratios
```

### 5.2 フリーワード埋め込み

```python
# app/services/text_embedder.py

from sentence_transformers import SentenceTransformer

class FragranceTextEmbedder:
    """フリーワードを384次元の意味ベクトルに変換"""
    
    def __init__(self):
        self.model = SentenceTransformer('intfloat/multilingual-e5-small')
        self.reference_embeddings = {}

    def embed(self, freeword: str) -> np.ndarray:
        if not freeword:
            return np.zeros(384)
        return self.model.encode(freeword)

    def compute_reference_vectors(self):
        """香りカテゴリの参照ベクトルを事前計算"""
        references = {
            'citrus_fresh':    '朝の柑橘 レモン水 さわやかな朝',
            'floral_elegant':  '薔薇園 エレガント 華やかなパーティー',
            'woody_calm':      '森林浴 静寂 木漏れ日 落ち着き',
            'marine_cool':     '海辺 潮風 夏の朝 透明感',
            'oriental_rich':   '夜のバー アンバー 大人 深み',
            'sweet_warm':      '焼き菓子 バニラ 冬のカフェ 温もり',
        }
        for key, text in references.items():
            self.reference_embeddings[key] = self.model.encode(text)
```

---

## 6. Layer 3：パーソナライズエンジン（FastAPI）

### 6.1 モデル設計

NMF（非負値行列分解）による協調フィルタリングを採用。新規ユーザーにはペルソナマッチングでコールドスタート対応。

```python
# app/models/personalize_model.py

import numpy as np
from sklearn.decomposition import NMF

class PersonalizeModel:
    """ユーザー嗜好に基づくレシピ微調整"""
    
    def __init__(self):
        self.nmf = NMF(n_components=10, max_iter=300)
        self.user_factors = None     # (n_users, 10)
        self.item_factors = None     # (n_ingredients, 10)
        self.persona_vectors = {}

    def train(self, feedback_matrix: np.ndarray):
        """
        feedback_matrix: (n_users, n_ingredients)
        値: ユーザーが各香料に対して示した嗜好スコア
        """
        self.user_factors = self.nmf.fit_transform(feedback_matrix)
        self.item_factors = self.nmf.components_.T

    def adjust_recipe(
        self,
        recipe: dict,
        user_id: int,
        feedback_history: list
    ) -> dict:
        if len(feedback_history) == 0:
            return self._cold_start_adjust(recipe, user_id)
        
        user_vec = self.user_factors[user_id]
        scores = user_vec @ self.item_factors.T
        
        adjusted = {}
        for item in recipe['recipe']:
            ing_id = item['ingredient_id']
            preference = scores[ing_id]
            delta = np.clip(preference * 5, -10, 10)
            adjusted_ratio = item['ratio'] + delta
            adjusted[ing_id] = max(adjusted_ratio, 0)
        
        total = sum(adjusted.values())
        recipe['recipe'] = [
            {
                **item,
                'ratio': round(
                    adjusted[item['ingredient_id']] / total * 100, 1
                )
            }
            for item in recipe['recipe']
            if adjusted[item['ingredient_id']] > 0
        ]
        
        return recipe

    def _cold_start_adjust(self, recipe: dict, user_id: int) -> dict:
        """新規ユーザー: アンケートからペルソナを推定して軽く調整"""
        persona = self._match_persona(user_id)
        if persona:
            return self._apply_persona_preference(
                recipe, persona, strength=0.5
            )
        return recipe
```

### 6.2 ペルソナ定義

```python
# data/personas.py

PERSONAS = {
    'fresh_morning': {
        'label': '朝型フレッシュ派',
        'description': '爽やかで清潔感のある香りを好む',
        'preferences': {
            'citrus': 0.9, 'green': 0.8, 'marine': 0.7,
            'floral_light': 0.5, 'wood_light': 0.4,
            'oriental': -0.3, 'sweet': -0.5,
        },
        'trigger_answers': {
            'time_preference': '朝',
            'intensity': '軽い',
            'mood': 'アクティブ',
        }
    },
    'elegant_evening': {
        'label': '夜のエレガント派',
        'description': '深みと華やかさのある香りを好む',
        'preferences': {
            'rose': 0.9, 'jasmine': 0.8, 'oriental': 0.7,
            'sandalwood': 0.6, 'amber': 0.5,
            'citrus': -0.2, 'marine': -0.4,
        },
        'trigger_answers': {
            'time_preference': '夜',
            'intensity': '強い',
            'mood': 'リラックス',
        }
    },
    'natural_outdoor': {
        'label': 'ナチュラルアウトドア派',
        'description': '自然な草木の香りを好む',
        'preferences': {
            'green': 0.9, 'herbal': 0.8, 'wood': 0.7,
            'moss': 0.6, 'citrus': 0.4,
            'sweet': -0.4, 'powder': -0.5,
        },
        'trigger_answers': {
            'time_preference': '昼',
            'intensity': '軽い',
            'mood': 'アクティブ',
        }
    },
    # ... 20-30パターンを定義
}
```

---

## 7. データベース設計

### 7.1 ER図概要

```
ingredients ──┬── prohibited_pairs
              ├── season_feeling_map
              ├── ingredient_compatibility
              ├── expert_recipes ── expert_recipe_items
              └── generated_recipes ── recipe_ingredients
                       │
                       └── user_recipe_feedbacks
                                │
users ──────────────────────────┤
              │                 └── user_preference_vectors
              └── user_persona_answers
```

### 7.2 テーブル定義

```sql
-- ============================================
-- Layer 1: ルールエンジン用テーブル
-- ============================================

-- 香料マスタ
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    note_type VARCHAR(20) NOT NULL
        CHECK (note_type IN ('top', 'middle', 'last')),
    category VARCHAR(50) NOT NULL,
    volatility DECIMAL(3,2),
    intensity DECIMAL(3,2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 禁止組み合わせ
CREATE TABLE prohibited_pairs (
    id SERIAL PRIMARY KEY,
    ingredient_a_id INT REFERENCES ingredients(id),
    ingredient_b_id INT REFERENCES ingredients(id),
    reason TEXT,
    UNIQUE(ingredient_a_id, ingredient_b_id)
);

-- 季節×感覚マッピング
CREATE TABLE season_feeling_map (
    id SERIAL PRIMARY KEY,
    season VARCHAR(10) NOT NULL,
    feeling VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority INT DEFAULT 1,
    UNIQUE(season, feeling, category)
);

-- ============================================
-- Layer 2: 配合生成用テーブル
-- ============================================

-- 香料ペア相性スコア
CREATE TABLE ingredient_compatibility (
    id SERIAL PRIMARY KEY,
    ingredient_a_id INT REFERENCES ingredients(id),
    ingredient_b_id INT REFERENCES ingredients(id),
    score DECIMAL(3,2) NOT NULL
        CHECK (score BETWEEN -1.0 AND 1.0),
    note TEXT,
    UNIQUE(ingredient_a_id, ingredient_b_id)
);

-- 調香師レシピ（学習データ）
CREATE TABLE expert_recipes (
    id SERIAL PRIMARY KEY,
    season VARCHAR(10),
    feeling VARCHAR(20),
    concept TEXT,
    quality_score INT CHECK (quality_score BETWEEN 1 AND 5),
    expert_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 調香師レシピの配合明細
CREATE TABLE expert_recipe_items (
    id SERIAL PRIMARY KEY,
    recipe_id INT REFERENCES expert_recipes(id),
    ingredient_id INT REFERENCES ingredients(id),
    ratio DECIMAL(5,2) NOT NULL CHECK (ratio >= 0 AND ratio <= 100),
    UNIQUE(recipe_id, ingredient_id)
);

-- ============================================
-- Layer 3: パーソナライズ用テーブル
-- ============================================

-- ユーザー
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI生成レシピ履歴
CREATE TABLE generated_recipes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    season VARCHAR(10),
    feeling VARCHAR(20),
    freeword TEXT,
    recipe JSONB NOT NULL,
    generation_method VARCHAR(20),
    layer2_confidence DECIMAL(3,2),
    layer3_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 生成レシピの配合明細
CREATE TABLE recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INT REFERENCES generated_recipes(id),
    ingredient_id INT REFERENCES ingredients(id),
    ratio DECIMAL(5,2) NOT NULL,
    UNIQUE(recipe_id, ingredient_id)
);

-- ユーザーフィードバック
CREATE TABLE user_recipe_feedbacks (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    recipe_id INT REFERENCES generated_recipes(id),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    sweetness_pref INT CHECK (sweetness_pref BETWEEN -2 AND 2),
    freshness_pref INT CHECK (freshness_pref BETWEEN -2 AND 2),
    intensity_pref INT CHECK (intensity_pref BETWEEN -2 AND 2),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ユーザー嗜好ベクトル（定期再計算）
CREATE TABLE user_preference_vectors (
    user_id INT PRIMARY KEY REFERENCES users(id),
    vector JSONB NOT NULL,
    sample_count INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- ペルソナ判定用アンケート回答
CREATE TABLE user_persona_answers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    time_preference VARCHAR(20),
    intensity_preference VARCHAR(20),
    mood_preference VARCHAR(20),
    matched_persona VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================

CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_note ON ingredients(note_type);
CREATE INDEX idx_generated_recipes_user ON generated_recipes(user_id);
CREATE INDEX idx_feedbacks_user ON user_recipe_feedbacks(user_id);
CREATE INDEX idx_feedbacks_recipe ON user_recipe_feedbacks(recipe_id);
CREATE INDEX idx_compatibility_pair
    ON ingredient_compatibility(ingredient_a_id, ingredient_b_id);
```

---

## 8. API設計

### 8.1 Laravel API Gateway

```php
// app/Http/Controllers/Api/RecipeController.php

class RecipeController extends Controller
{
    public function generate(RecipeRequest $request)
    {
        $validated = $request->validated();
        
        // Layer 1: ルールエンジン（Laravel内）
        $filtered = app(RuleEngine::class)->filterCandidates(
            season:   $validated['season'],
            feeling:  $validated['feeling'],
            freeword: $validated['freeword'] ?? null,
        );
        
        // Layer 2: 配合生成（FastAPI呼び出し）
        $blendResponse = Http::post(
            config('services.blend_api.url') . '/api/v1/blend/generate',
            [
                'candidate_ids'      => $filtered->candidateIds(),
                'candidate_features' => $filtered->candidateFeatures(),
                'constraints'        => $filtered->constraints,
                'context'            => $filtered->context,
            ]
        );
        $recipe = $blendResponse->json();
        
        // Layer 3: パーソナライズ（FastAPI呼び出し）
        $personalizedResponse = Http::post(
            config('services.personalize_api.url') . '/api/v1/personalize/adjust',
            [
                'recipe'  => $recipe,
                'user_id' => auth()->id(),
            ]
        );
        $finalRecipe = $personalizedResponse->json();
        
        // レシピを保存
        $saved = GeneratedRecipe::create([
            'user_id'            => auth()->id(),
            'season'             => $validated['season'],
            'feeling'            => $validated['feeling'],
            'freeword'           => $validated['freeword'] ?? null,
            'recipe'             => $finalRecipe['recipe'],
            'generation_method'  => $finalRecipe['method'],
            'layer2_confidence'  => $recipe['confidence'],
            'layer3_applied'     => $finalRecipe['personalized'],
        ]);
        
        return response()->json([
            'recipe'  => $saved,
            'concept' => $finalRecipe['concept'],
        ]);
    }
}
```

### 8.2 FastAPI エンドポイント

```python
# main.py

from fastapi import FastAPI
from contextlib import asynccontextmanager

blend_model: BlendModel = None
personalize_model: PersonalizeModel = None
text_embedder: FragranceTextEmbedder = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global blend_model, personalize_model, text_embedder
    
    blend_model = BlendModel()
    blend_model.load("models/blend_v1.pkl")
    blend_model.compatibility_matrix = load_compatibility_matrix()
    
    personalize_model = PersonalizeModel()
    personalize_model.load("models/personalize_v1.pkl")
    
    text_embedder = FragranceTextEmbedder()
    text_embedder.compute_reference_vectors()
    yield

app = FastAPI(lifespan=lifespan)


@app.post("/api/v1/blend/generate")
async def generate_blend(request: BlendRequest):
    """Layer 2: 配合生成"""
    freeword_emb = text_embedder.embed(request.context.get('freeword'))
    
    blend_input = BlendInput(
        candidate_ids=request.candidate_ids,
        candidate_features=np.array(request.candidate_features),
        season_encoded=encode_season(request.context['season']),
        feeling_encoded=encode_feeling(request.context['feeling']),
        freeword_embedding=freeword_emb,
        constraints=request.constraints,
    )
    
    result = blend_model.predict(blend_input)
    return {
        "recipe": result['recipe'],
        "concept": result['concept'],
        "confidence": result['confidence'],
        "method": "ml"
    }


@app.post("/api/v1/personalize/adjust")
async def adjust_recipe(request: PersonalizeRequest):
    """Layer 3: パーソナライズ"""
    history = await get_feedback_history(request.user_id)
    
    adjusted = personalize_model.adjust_recipe(
        recipe=request.recipe,
        user_id=request.user_id,
        feedback_history=history,
    )
    return {
        "recipe": adjusted['recipe'],
        "concept": adjusted.get('concept'),
        "personalized": len(history) > 0,
        "method": "ml"
    }
```

### 8.3 APIエンドポイント一覧

| Method | Endpoint | Layer | 説明 |
|--------|----------|-------|------|
| POST | `/api/recipes/generate` | Gateway | レシピ生成（3層パイプライン実行） |
| POST | `/api/recipes/{id}/feedback` | L3 | ユーザー評価の送信 |
| GET | `/api/recipes/history` | - | 生成レシピ履歴 |
| GET | `/api/ingredients` | L1 | 香料一覧 |
| POST | `/api/users/persona-quiz` | L3 | ペルソナ判定アンケート |
| GET | `/api/users/preference` | L3 | ユーザー嗜好情報 |
| POST | `/api/v1/blend/generate` | L2 内部 | 配合生成（FastAPI） |
| POST | `/api/v1/personalize/adjust` | L3 内部 | パーソナライズ（FastAPI） |

---

## 9. モデル学習パイプライン

### 9.1 初期学習

事前準備データを使ったモデルの初回学習。

```python
# scripts/initial_train.py

async def initial_train():
    """初回モデル学習（デプロイ前に実行）"""
    
    # --- Layer 2: 配合モデル ---
    expert_recipes = await db.fetch("""
        SELECT er.*, array_agg(
            json_build_object(
                'ingredient_id', eri.ingredient_id,
                'ratio', eri.ratio
            )
        ) as items
        FROM expert_recipes er
        JOIN expert_recipe_items eri ON er.id = eri.recipe_id
        WHERE er.quality_score >= 3
        GROUP BY er.id
    """)
    
    df = prepare_blend_training_data(expert_recipes)
    blend_model = BlendModel()
    blend_model.train(df)
    blend_model.save("models/blend_v1.pkl")
    
    # --- Layer 3: パーソナライズモデル ---
    # 初期はペルソナデータからシード行列を生成
    seed_matrix = generate_seed_matrix_from_personas(PERSONAS)
    personalize_model = PersonalizeModel()
    personalize_model.train(seed_matrix)
    personalize_model.save("models/personalize_v1.pkl")
```

### 9.2 定期再学習

ユーザーデータが蓄積された後の定期再学習スクリプト。

```python
# scripts/retrain_models.py

"""
Cron or Cloud Scheduler で週次実行
"""

async def retrain_blend_model():
    """Layer 2 モデルの再学習"""
    recipes = await db.fetch("""
        SELECT r.*, avg(f.rating) as avg_rating
        FROM generated_recipes r
        LEFT JOIN user_recipe_feedbacks f ON r.id = f.recipe_id
        GROUP BY r.id
        HAVING avg(f.rating) >= 3.5 OR r.generation_method = 'expert'
    """)
    
    df = prepare_training_data(recipes)
    model = BlendModel()
    model.train(df)
    
    # 精度評価
    metrics = model.evaluate(test_df)
    if metrics['mae'] < current_model_metrics['mae']:
        model.save(f"models/blend_{datetime.now():%Y%m%d}.pkl")
        deploy_model("blend", model)


async def retrain_personalize_model():
    """Layer 3 モデルの再学習"""
    feedbacks = await db.fetch("""
        SELECT user_id, ingredient_id, avg(rating) as score
        FROM user_recipe_feedbacks f
        JOIN recipe_ingredients ri ON f.recipe_id = ri.recipe_id
        GROUP BY user_id, ingredient_id
    """)
    
    matrix = build_feedback_matrix(feedbacks)
    model = PersonalizeModel()
    model.train(matrix)
    model.save(f"models/personalize_{datetime.now():%Y%m%d}.pkl")
```

---

## 10. インフラ構成

### 10.1 Docker Compose（開発環境）

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Laravel API Gateway + Layer 1
  laravel:
    build: ./docker/laravel
    ports:
      - "8000:8000"
    volumes:
      - ./laravel-app:/var/www/html
    depends_on:
      - postgres
      - redis
    environment:
      - DB_HOST=postgres
      - BLEND_API_URL=http://blend-api:8001
      - PERSONALIZE_API_URL=http://personalize-api:8002

  # FastAPI Layer 2 - 配合生成
  blend-api:
    build: ./docker/fastapi-blend
    ports:
      - "8001:8001"
    volumes:
      - ./ml-services/blend:/app
      - ./models:/app/models
    depends_on:
      - postgres

  # FastAPI Layer 3 - パーソナライズ
  personalize-api:
    build: ./docker/fastapi-personalize
    ports:
      - "8002:8002"
    volumes:
      - ./ml-services/personalize:/app
      - ./models:/app/models
    depends_on:
      - postgres

  # PostgreSQL
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: fragrance_app
      POSTGRES_USER: fragrance
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # React フロントエンド
  frontend:
    build: ./docker/frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app

volumes:
  postgres_data:
```

### 10.2 ディレクトリ構成

```
fragrance-app/
├── docker/
│   ├── laravel/
│   ├── fastapi-blend/
│   ├── fastapi-personalize/
│   └── frontend/
├── laravel-app/                    # Layer 1 + API Gateway
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   └── RecipeController.php
│   │   ├── Models/
│   │   │   ├── Ingredient.php
│   │   │   ├── GeneratedRecipe.php
│   │   │   └── UserRecipeFeedback.php
│   │   └── Services/Fragrance/
│   │       ├── RuleEngine.php
│   │       └── FilteredResult.php
│   ├── database/migrations/
│   └── routes/api.php
├── ml-services/
│   ├── blend/                      # Layer 2
│   │   ├── app/
│   │   │   ├── models/
│   │   │   │   └── blend_model.py
│   │   │   └── services/
│   │   │       └── text_embedder.py
│   │   ├── main.py
│   │   └── requirements.txt
│   └── personalize/                # Layer 3
│       ├── app/
│       │   └── models/
│       │       └── personalize_model.py
│       ├── data/
│       │   └── personas.py
│       ├── main.py
│       └── requirements.txt
├── models/                         # 学習済みモデル
│   ├── blend_v1.pkl
│   └── personalize_v1.pkl
├── scripts/
│   ├── initial_train.py
│   └── retrain_models.py
├── frontend/                       # React
│   ├── src/
│   │   ├── components/
│   │   │   ├── RecipeForm.jsx
│   │   │   ├── RecipeResult.jsx
│   │   │   └── FeedbackForm.jsx
│   │   └── pages/
│   └── package.json
└── docker-compose.yml
```

---

## 11. Mecrear AIエージェントへの展開戦略

### 11.1 共通パターン

香り生成アプリで構築する3層アーキテクチャは、Mecrearの分析AIエージェントにそのまま転用できる。

```
【香り生成アプリ】               【Mecrear AI分析】

Layer 1 ルール                   Layer 1 ルール
  香料相性・禁止組合せ        →    医療ガイドライン・禁忌

Layer 2 MLモデル                 Layer 2 MLモデル
  配合比率の最適化            →    治療効果の予測・分析

Layer 3 メタ学習                 Layer 3 メタ学習
  ユーザーの嗜好学習          →    患者個人の傾向学習

入力: 季節+感覚+キーワード   →  入力: 症状+検査値+既往歴
出力: 香料レシピ              →  出力: 治療提案・リスク分析
```

### 11.2 Mecrear AIエージェント構想

```
         患者データ（EMR）
              │
    ┌─────────▼─────────┐
    │  ルールエンジン      │  医療安全の絶対ルール
    │  (Gate Keeper)      │  - 薬剤禁忌チェック
    │                     │  - アレルギー確認
    │                     │  - ガイドライン準拠
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  分析エージェント    │  LLM + 構造化データ
    │  (AI Agent)         │  - 治療履歴の分析
    │                     │  - 類似症例の検索
    │                     │  - 施術効果の予測
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  パーソナライズ      │  患者個人への最適化
    │  (Meta Learning)    │  - 過去の反応パターン
    │                     │  - 来院傾向の予測
    │                     │  - カスタム提案
    └─────────┬─────────┘
              │
         医師への提案表示
         （最終判断は必ず医師）
```

### 11.3 技術スタックの共通化

| 共通コンポーネント | 香りアプリでの実装 | Mecrearでの転用 |
|---|---|---|
| ルールエンジン基盤 | Laravel（香料ルール管理） | Laravel（医療ルール管理） |
| ML推論マイクロサービス | FastAPI + scikit-learn | FastAPI + 同一フレームワーク |
| テキスト埋め込み | multilingual-e5-small | 同一モデルで症状テキスト埋込 |
| フィードバック学習 | NMF協調フィルタリング | NMFで患者嗜好学習 |
| DB | PostgreSQL + JSONB | 同一（Mecrear既存DB拡張） |

### 11.4 展開ロードマップ

```
2026年
 Q1  香り生成アプリ 全Layer実装・リリース
     └── 3層アーキテクチャの基盤を確立
     
 Q2  香りアプリ運用・データ蓄積
     Mecrear AI分析 設計開始
     └── 香りアプリの基盤コードをMecrearに移植
     
 Q3  Mecrear AI分析 Phase 1（ルール+MLモデル）
     香りアプリ モデル再学習サイクル運用
     
 Q4  Mecrear AI分析 Phase 2（+エージェント機能）
     └── 香りアプリのメタ学習基盤を転用
```

---

## 12. フレグランスマップ機能

### 12.1 背景・目的

旧アプリのレビューにより、ユーザーが作成した香りと実際のイメージが異なるという課題が判明した。ユーザーに「近い香りのイメージ」を伝えるため、実在する有名フレグランスのリファレンスデータベースを構築し、ユーザーの調合結果が香りの世界のどこに位置するかを2D散布図で可視化する機能を追加した。

### 12.2 設計方針

| 項目 | 方針 | 選定理由 |
|------|------|----------|
| 座標軸 | セマンティック軸（手動定義）「フレッシュ ←→ ウォーム」×「ウッディ ←→ フローラル」 | ユーザーに直感的。リファレンス増減で軸の意味が変わらない（PCAの欠点を回避） |
| リファレンスデータ | TypeScript定数としてハードコード（25種） | 頻繁に変わらないデータ。マイグレーション不要でシンプル。クライアントサイド完結で高速 |
| 類似度計算 | コサイン類似度（26次元配合ベクトル） | スパースベクトルに強い。配合パターンの類似性比較に最適 |
| 可視化 | Recharts ScatterChart | プロジェクト既存のRechartsを活用。追加ライブラリ不要 |

### 12.3 座標系

26香料それぞれにセマンティック座標 `{ x, y }` を手動定義。

```
x軸: フレッシュ(-1) ←→ ウォーム(+1)
y軸: ウッディ(-1)  ←→ フローラル(+1)
```

4象限の意味:

```
            フローラル (+y)
                │
  フレッシュ×フローラル │ ウォーム×フローラル
   (ミュゲ, ラベンダー)  │  (ジャスミン, チュベローズ)
                │
 ─────────────┼───────────── x
                │
  フレッシュ×ウッディ   │ ウォーム×ウッディ
   (ライム, シーブルー)  │  (サンダルウッド, レザー)
                │
            ウッディ (-y)
```

ユーザーの配合結果は、各香料の配合比率を重みとした加重平均でマップ座標を算出する。

### 12.4 リファレンスフレグランス

25種の有名フレグランスをマップ上で広い領域をカバーするよう各カテゴリから均等に選出。

| 領域 | フレグランス | 数 |
|------|------------|---|
| フレッシュ・シトラス | Acqua di Gio, CK One, Light Blue, Eau de Cologne Imperiale | 4 |
| フレッシュ・フローラル | Daisy, Chance Eau Fraiche, Miss Dior Blooming Bouquet | 3 |
| フローラル中心 | Chanel No.5, J'adore, Flowerbomb, Chloe EDP | 4 |
| ウォーム・フローラル | Black Opium, La Vie Est Belle, Mon Paris | 3 |
| ウッディ・フレッシュ | Terre d'Hermes, Bleu de Chanel, Sauvage | 3 |
| ウッディ・ウォーム | Tom Ford Oud Wood, Bvlgari Man in Black | 2 |
| オリエンタル | Shalimar, Opium, Angel | 3 |
| バランス型 | L'Eau d'Issey, Le Male | 3 |

各フレグランスは26香料への近似配合ベクトル（合計1.0）と事前計算済みマップ座標を保持する。

### 12.5 類似度計算

コサイン類似度により、ユーザーの26次元配合ベクトルと各リファレンスフレグランスの配合ベクトルを比較し、Top 3を表示する。

```
similarity(A, B) = (A · B) / (|A| × |B|)
```

全てクライアントサイドで計算可能（サーバーAPI不要）。

### 12.6 UI構成

調合結果ページ（`/result/[id]`）の既存コンテンツ（配合比率 + 円グラフ + ストーリー）の下に2つのセクションを追加。

```
┌─────────────────────────────────────────────┐
│  調合結果（既存）                              │
│  ┌──────────────┐ ┌──────────────────────┐   │
│  │ 配合比率      │ │ 配合チャート（円グラフ）│   │
│  │ TOP / MID / LAST│ │                     │   │
│  └──────────────┘ │ ストーリー            │   │
│                    └──────────────────────┘   │
├─────────────────────────────────────────────┤
│  フレグランスマップ（新規）                     │
│  ┌─────────────────────────────────────────┐ │
│  │          ScatterChart                    │ │
│  │  ○ リファレンス（グレー）                  │ │
│  │  △ 類似Top3（ピンク三角）                 │ │
│  │  ★ ユーザーの香り（黒い星）               │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  あなたの香りに近いフレグランス（新規）          │
│  #1  シャネル No.5         類似度 87% ████░░  │
│  #2  ジャドール            類似度 82% ████░░  │
│  #3  クロエ EDP            類似度 76% ███░░░  │
└─────────────────────────────────────────────┘
```

### 12.7 ファイル構成

```
apps/web/
├── lib/fragrance-map/
│   ├── types.ts                 # 型定義（FlavorCoordinate, ReferenceFragrance, SimilarResult, MapPosition）
│   ├── flavor-coordinates.ts    # 26香料のx,y座標定義
│   ├── reference-fragrances.ts  # 25種リファレンスデータ + 座標事前計算
│   └── similarity.ts            # calculatePosition, cosineSimilarity, findSimilarFragrances
├── components/
│   ├── fragrance-map.tsx        # ScatterChart散布図（Client Component）
│   └── similar-fragrances.tsx   # 類似Top3カード（Client Component）
└── app/(customer)/result/[id]/
    └── page.tsx                 # 既存ページにマップセクション統合
```

### 12.8 3層アーキテクチャとの関係

フレグランスマップは3層パイプライン（ルール → ML → パーソナライズ）とは独立した**表示レイヤー**の機能である。配合結果が確定した後に、その結果を可視化・説明するために動作する。

```
Layer 1 → Layer 2 → Layer 3 → 配合結果確定
                                    │
                              ┌─────▼─────┐
                              │ フレグランス │  ← 表示レイヤー（クライアントサイド）
                              │ マップ機能  │
                              └───────────┘
```

将来的にLayer 2/3が実装された場合も、フレグランスマップはそのまま機能する。配合結果のベクトルを入力として受け取るだけであり、配合がどのように生成されたかには依存しない。

---

## 付録

### A. LLMの活用箇所（MLモデル外）

データ事前準備によりML推論にLLMは不要だが、以下の用途でLLMを活用する。

| 用途 | 説明 |
|------|------|
| フリーワード → 概念変換 | Embedding生成（sentence-transformers） |
| レシピコンセプト文生成 | 生成したレシピの説明テキスト作成（UX向上） |
| チャット型UI | 将来的に対話形式での香り相談機能 |

### B. 性能比較

| 指標 | LLM依存アーキテクチャ | ML本格稼働アーキテクチャ |
|------|----------------------|------------------------|
| 推論レイテンシ | 2-5秒 | 100-300ms |
| 月額API費用（1万リクエスト想定） | ¥30,000-50,000 | ほぼゼロ |
| オフライン動作 | 不可 | 可能 |
| 初期データ要件 | 不要 | 調香師レシピ300件以上 |
| パーソナライズ精度 | 中（プロンプト依存） | 高（データ蓄積で向上） |

---

*最終更新: 2026年2月14日*
*プロジェクト: 株式会社キャライノベイト 香り提案アプリ*
