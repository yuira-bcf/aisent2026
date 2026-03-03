# KARF 定期レビュー実行ガイド

> KyaraInnovate Architecture Review Framework — 定期実行ワークフロー

最終更新: 2026-02-17

---

## 1. レビュー実行スケジュール

| タイミング | 実行範囲 | 目的 |
|---|---|---|
| **スプリント終了時** | Phase 1 (C4構造検証) のみ | 構造の乖離を早期検出 |
| **マイルストーン到達時** | Phase 1–3 (C4 + ISO + FMEA) | 品質特性の網羅的評価 + リスク定量化 |
| **リリース前** | Phase 1–4 全フェーズ | ATAM含む完全レビュー |
| **インシデント後** | 影響範囲に該当するPhase | 根本原因の構造的分析 |

---

## 2. 実行手順（5ステップ）

### Step 1: Claude Code エージェント起動

```bash
# リポジトリルートで実行
claude

# プロンプト例（リリース前 = 全フェーズ）
> docs/architecture-review-framework.md に基づき、KARF Phase 1〜4 の全フェーズレビューを実行してください。
> 結果は docs/karf/results/YYYY-MM-DD.json に出力してください。
> 前回結果: docs/karf/results/2026-02-17.json を参照し、既存FMEAアイテムのステータスも更新してください。

# プロンプト例（スプリント終了 = Phase 1のみ）
> docs/architecture-review-framework.md のPhase 1（C4構造検証）のみ実行してください。
> 結果は docs/karf/results/YYYY-MM-DD.json に出力してください。
```

### Step 2: JSON結果ファイルの確認チェックリスト

生成された JSON ファイルを以下の観点で確認:

- [ ] `reviewId` が一意（例: `KARF-2026-002`）
- [ ] `reviewDate` が実行日と一致
- [ ] `targetVersion` が現在のバージョンと一致
- [ ] `fmeaItems` の件数が正しい（既存 + 新規発見）
- [ ] 全 FMEA アイテムに `S`, `O`, `D`, `RPN` が設定済み
- [ ] `severity` が RPN に基づき正しく分類
  - Critical: RPN ≥ 200
  - High: RPN 100–199
  - Medium: RPN 50–99
  - Low: RPN < 50
- [ ] `summary` の集計値が `fmeaItems` と整合
- [ ] C4結果の P/W/F 合計がチェック項目数と一致
- [ ] ISO 25010 の8特性すべてに結果あり

### Step 3: dashboard.html の REVIEW_DATA に追記

`docs/karf/dashboard.html` を開き、`REVIEW_DATA` 配列の末尾に新しいレビュー結果を追加:

```javascript
// dashboard.html 内の REVIEW_DATA 配列
const REVIEW_DATA = [
  { /* 2026-02-17 初回レビュー */ },
  // ↓ 新しいレビューを追加
  { /* 2026-XX-XX 第2回レビュー */ }
];
```

**注意**: JSON ファイルの内容をそのまま配列要素としてコピーする。

### Step 4: 既存アイテムのステータス更新ルール

前回レビューの FMEA アイテムについて、以下のルールでステータスを更新:

| 条件 | ステータス |
|---|---|
| 修正が完了し、レビューで問題なしと確認 | `"resolved"` |
| 修正に着手済みだが完了していない | `"in_progress"` |
| 未着手 | `"open"` |

ステータス更新は **新しいレビューの JSON 内** で行う。過去のJSONは変更しない（スナップショットとして保持）。

### Step 5: karf-review-report.md の最新化

必要に応じて `docs/karf-review-report.md` のマークダウンレポートも更新:

- エグゼクティブサマリーの数値更新
- 新規発見項目の追記
- 解決済み項目のマーキング
- クリティカルパスの再評価

---

## 3. 改善率算出方法

### 定義

```
改善率 = (resolvedCount / 初回レビュー総件数) × 100
```

### ルール

- **分母**: 初回レビュー時の総 FMEA 件数（**50件で固定**）
- **分子**: 最新レビューで `"resolved"` ステータスの全アイテム数
- 改善率は累積的 — 一度 resolved になったアイテムが再発した場合は `"open"` に戻す

### 算出例

| レビュー | resolved | 改善率 |
|---|---|---|
| 第1回 (2026-02-17) | 0 | 0% |
| 第2回 (想定) | 5 | 10% |
| 第3回 (想定) | 15 | 30% |

---

## 4. 新規発見アイテムの扱い

### 採番ルール

- 初回レビュー: FM-001 〜 FM-050
- 第2回以降の新規発見: FM-051, FM-052, ... と連番で採番
- **欠番は作らない**（削除されたアイテムのIDは再利用しない）

### 改善率への影響

- **改善率の分母は初回の50件で固定**
- 新規発見アイテムは改善率の計算に含めない（分母が増えると過去との比較が困難になるため）
- ただし、新規アイテム数はダッシュボードの「総件数」KPI に反映される

### カテゴリ

9種のカテゴリは固定:

| カテゴリ | 対象範囲 |
|---|---|
| セキュリティ | 認証・認可・暗号化・脆弱性 |
| 信頼性 | トランザクション・冪等性・障害許容 |
| 機能性 | API欠如・CRUD不足・機能未実装 |
| 保守性 | テスト・CI/CD・デッドコード・重複 |
| 性能 | N+1・インデックス・キャッシュ |
| 移植性 | 環境変数・ベンダーロックイン |
| 互換性 | API互換・プロトコル・設定不整合 |
| 使用性 | UI/UX・空状態・アクセシビリティ |
| ドキュメント | 設計書不整合・未文書化 |

---

## 5. ファイル命名規則とコミットメッセージ

### ファイル命名規則

```
docs/karf/results/YYYY-MM-DD.json
```

- 日付は ISO 8601 形式
- 同日に複数回実行する場合: `YYYY-MM-DD-2.json`

### ディレクトリ構造

```
docs/karf/
├── results/
│   ├── 2026-02-17.json     # 初回レビュー
│   ├── 2026-03-01.json     # 第2回（例）
│   └── ...
├── dashboard.html           # ダッシュボード
└── karf-workflow.md          # このファイル
```

### コミットメッセージ例

```bash
# 新規レビュー実行時
git commit -m "docs(karf): add review results for 2026-03-01

- Phase 1-4 full review completed
- 5 items resolved (FM-036, FM-037, FM-038, FM-043, FM-034)
- 2 new items discovered (FM-051, FM-052)
- Improvement rate: 10%"

# ダッシュボード更新時
git commit -m "docs(karf): update dashboard with 2026-03-01 review data"

# ワークフロー改善時
git commit -m "docs(karf): update workflow guide with lessons learned"
```

---

## 6. 参考リンク

- [KARF フレームワーク定義](../architecture-review-framework.md)
- [KARF ダッシュボード](dashboard.html)
- [初回レビューレポート](../karf-review-report.md)

---

*Generated as part of KARF v1.0 — KyaraInnovate Architecture Review Framework*
