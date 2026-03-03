# KARF アーキテクチャレビュー統合レポート

> KyaraInnovate Architecture Review Framework 実行結果

| 項目 | 内容 |
|------|------|
| 対象 | KyaraInnovate v3.0 (ハイブリッド調合アーキテクチャ) |
| 評価日 | 2026-02-17 |
| 分析者 | KARF Automated Architecture Reviewer (14 agents) |
| 評価手法 | C4 Model + ISO 25010 + FMEA + ATAM |

---

## 1. エグゼクティブサマリー

### 1.1 全体スコアボード

| フェーズ | 手法 | Pass | Warn | Fail | 検出課題数 |
|----------|------|------|------|------|-----------|
| Phase 1-L1 | C4 Context | 3 | 2 | 0 | 5 |
| Phase 1-L2 | C4 Container | 1 | 4 | 0 | 9 |
| Phase 1-L3 | C4 Component | 2 | 2 | 2 | 13 |
| Phase 1-L4 | C4 Code | 3 | 3 | 0 | 10 |
| Phase 2 | ISO 25010 (8特性) | 3 | 5 | 0 | — |
| Phase 3 | FMEA | — | — | — | 50 (RPN算出) |
| Phase 4 | ATAM | 3適切 | 5要注意 | — | 10リスク |
| **合計** | | **15** | **21** | **2** | **50 FM** |

### 1.2 FMEA リスク分布

| 重大度 | 件数 | RPN範囲 |
|--------|------|---------|
| **Critical** (≥200) | **27** | 210–810 |
| High (100–199) | 14 | 100–192 |
| Medium (50–99) | 3 | 72–96 |
| Low (<50) | 3 | 16–40 |

### 1.3 総合判定

**リリース前に27件のCritical項目の修正が必須**。特にセキュリティ（平均RPN 419）と信頼性（平均RPN 347）のカテゴリが深刻。決済を扱うプラットフォームとして、レート制限・トランザクション・監査ログの3点は最低限の必須要件。

---

## 2. Phase 1: C4 構造検証

### 2.1 L1 — Context Level (P:3 / W:2 / F:0)

| チェック項目 | 判定 | 要旨 |
|---|---|---|
| C1.1 外部システム一覧 | **W** | 7外部システム中、Sentry がコア設計書に未記載。Vercel は部分的のみ |
| C1.2 通信プロトコル | **W** | AI Service/Stripe は明記済。Redis/PostgreSQL/Resend/Sentry は暗黙的 |
| C1.3 ユーザー種別 | **P** | CUSTOMER/CREATOR/ADMIN — 要件定義書とコード一致 |
| C1.4 データフロー | **P** | 調合・注文・認証・AI の全フロー文書化済 |
| C1.5 フォールバック | **P** | 5障害シナリオ（App/DB/Region/Stripe/Redis）全てに対応策定義 |

### 2.2 L2 — Container Level (P:1 / W:4 / F:0)

| チェック項目 | 判定 | 要旨 |
|---|---|---|
| C2.1 コンテナ一覧 | **W** | 4コンテナ定義済だがPython AI Service廃止通知とdocker-composeが矛盾 |
| C2.2 コンテナ間通信 | **W** | DB/AI接続は正常。REDIS_URLがwebサービスに未設定 |
| C2.3 スケーリング戦略 | **P** | Vercel serverless + pgBouncer + Redis 3層キャッシュ、包括的 |
| C2.4 コンテナ間認証 | **W** | INTERNAL_SERVICE_TOKENが env.ts でoptional。Redis認証なし |
| C2.5 環境別設定 | **W** | preview/staging CI有。production deployジョブなし |

### 2.3 L3 — Component Level (P:2 / W:2 / F:2)

| チェック項目 | 判定 | 要旨 |
|---|---|---|
| C3.1 サービス層責務分離 | **P** | 7サービスファイル、各1ドメイン、相互インポートゼロ |
| C3.2 スキーマ→API カバレッジ | **F** | **recipe-service(8関数)とreview-service(4関数)がAPIルートゼロ**。creator_profiles等3テーブルもサービス層なし |
| C3.3 共有ユーティリティ重複 | **W** | IP抽出ロジックが2ファイルで重複。ページネーション計算が8箇所で繰返し |
| C3.4 画面→API トレーサビリティ | **F** | **16+モックアップ画面にAPIバッキングなし**（creators, recipe-detail, write-review, admin-products 等） |
| C3.5 循環依存 | **P** | 全サービス・スキーマともDAG構造。循環なし |
| C3.6 ミドルウェア適用 | **W** | requireAuth は適切だが rate-limiter/audit-logger/security-headers は全てスタブ/未接続 |

### 2.4 L4 — Code Level (P:3 / W:3 / F:0)

| チェック項目 | 判定 | 要旨 |
|---|---|---|
| C4.1 型定義とDB整合 | **P** | 全サービスの型がDBスキーマと一致 |
| C4.2 Zodバリデーション | **W** | blend weight Zod max(10) vs DB decimal(3,0)不整合。review Zod max(1000) vs DB text制約なし |
| C4.3 エクスポート完全性 | **W** | index.ts再エクスポートは完全。users/flavors/keywordsに $inferSelect/Insert 型なし（security.tsとの不整合） |
| C4.4 命名規則 | **P** | snake_case (DB) / camelCase (TS) / 動詞+名詞 (関数) 全て一貫 |
| C4.5 デッドコード | **W** | review-service.ts/recipe-service.ts/audit-logger.ts/rate-limiter.ts/security-headers.ts 全体がデッドコード |
| C4.6 エラーハンドリング | **P** | safeHandler + apiSuccess/apiError パターンが全26ルートで一貫 |

---

## 3. Phase 2: ISO 25010 品質特性評価

| 品質特性 | 判定 | サブ特性評価 |
|----------|------|-------------|
| **機能適合性** | **F** | 完全性W（レシピ/レビュー/クリエーターAPI欠如）、正確性P、適切性P |
| **性能効率性** | **W** | 時間効率W（N+1パターン、直列クエリ）、資源効率P、容量P |
| **互換性** | **W** | 共存性P、相互運用性W（API版管理戦略未定義） |
| **使用性** | **W** | 認識容易性P、学習容易性P、操作容易性W（空状態/ローディング未定義）、**アクセシビリティF**（コード内にaria属性なし） |
| **信頼性** | **W** | 成熟度W（トランザクション未使用が複数）、可用性P、障害許容W（webhook冪等性なし）、回復性P |
| **セキュリティ** | **W** | 機密性W（JWTブラックリストなし）、完全性W（CSRF/CSP適用なし）、否認防止W（監査ログ未実装）、認証P、認可P |
| **保守性** | **F** | モジュール性P、再利用性P、**テスト容易性F（テストカバレッジ〜5%）**、変更容易性W |
| **移植性** | **W** | 適応性P、設置性W（本番deploy CI なし）、置換容易性W（Stripe/AI密結合） |

---

## 4. Phase 3: FMEA — Top 10 Critical リスク

| 順位 | ID | 故障モード | RPN | カテゴリ |
|------|-----|-----------|-----|---------|
| 1 | FM-036 | **レート制限スタブ（always allowed）+ 未接続** | **810** | セキュリティ |
| 2 | FM-043 | **テストカバレッジ 〜5%（2ファイルのみ）** | **720** | 保守性 |
| 3 | FM-038 | **監査ログ DB INSERT が TODO + 未接続** | **640** | セキュリティ |
| 4 | FM-037 | **セキュリティヘッダー未適用（CSP/HSTS/X-Frame）** | **630** | セキュリティ |
| 5 | FM-034 | **Stripe Webhook 冪等性チェックなし** | **448** | 信頼性 |
| 6 | FM-033 | **createOrder() トランザクションなし（10ステップ）** | **432** | 信頼性 |
| 7 | FM-039 | **脅威モデル文書なし（STRIDE/OWASP）** | **420** | セキュリティ |
| 8 | FM-031 | **executeBlend() トランザクションなし（8ステップ）** | **392** | 信頼性 |
| 9 | FM-022 | **注文ステータス遷移バリデーションなし** | **336** | 信頼性 |
| 10 | FM-007 | **recipe-service 8関数が APIルート 0** | **336** | 機能性 |

### FMEA カテゴリ別平均RPN

```
セキュリティ  ████████████████████████████████████████ 419
信頼性       ██████████████████████████████████  347
機能性       ████████████████████████  250
保守性       ████████████████████████  249
性能         ██████████████████  185
移植性       ████████████████  163
互換性       ██████████████  150
使用性       ████████  88
```

---

## 5. Phase 4: ATAM シナリオ分析

### 5.1 シナリオ評価結果

| ID | シナリオ | 品質属性 | 評価 |
|----|---------|---------|------|
| AS-001 | 調合リアルタイム計算 vs キュー | 性能 vs UX | **要注意** |
| AS-002 | セッション管理 JWT vs Server Session | セキュリティ vs スケーラビリティ | **要注意** |
| AS-003 | レシピ配合 正規化 vs 非正規化 | 整合性 vs クエリ性能 | 適切 |
| AS-004 | 通知 ポーリング vs SSE/WebSocket | UX vs 実装複雑性 | **要注意** |
| AS-005 | 検索 PostgreSQL vs Elasticsearch | 検索性能 vs 運用コスト | 適切 |
| AS-006 | 画像 Vercel Blob vs S3 | 開発速度 vs ベンダーロックイン | **要注意** |
| AS-007 | モノレポ構成の妥当性 | 開発効率 vs ビルド複雑性 | 適切 |
| AS-008 | AI Service 分離の妥当性 | 可用性 vs 実装複雑性 | **要注意** |

### 5.2 感度点（Sensitivity Points）

| ID | 感度点 | 影響する品質属性 |
|----|--------|----------------|
| SP-1 | AI API (claude-sonnet-4.5) のレスポンスタイム | 性能、UX |
| SP-2 | DB 接続プール最大数 (max: 10) | 性能、可用性 |
| SP-3 | JWT maxAge (30 日) | セキュリティ |
| SP-4 | レシピ数の増加速度 | 検索性能 |
| SP-5 | Vercel Serverless Function の同時実行数制限 | スケーラビリティ |
| SP-6 | Redis の可用性 | レート制限、キャッシュ、分散ロック |

### 5.3 トレードオフ点（Tradeoff Points）

| ID | トレードオフ | 品質属性 A ↔ B |
|----|------------|----------------|
| TP-1 | リアルタイム計算 vs キュー | UX (即時応答) ↔ スケーラビリティ |
| TP-2 | JWT vs Server Session | スケーラビリティ ↔ セキュリティ (即時無効化) |
| TP-3 | Vercel Blob vs S3 | 開発速度 ↔ ベンダー非依存 |
| TP-4 | ポーリング vs SSE | 実装複雑性 ↔ UX (リアルタイム性) |
| TP-5 | PostgreSQL直接 vs Elasticsearch | 運用コスト ↔ 検索品質 |
| TP-6 | Vercel AI SDK統合 vs サービス分離 | 運用単純性 ↔ 障害分離 |

### 5.4 Non-Risks（適切に対処済み）

| # | 懸念事項 | 適切な理由 |
|---|---------|-----------|
| NR-1 | 配合計算の精度 | Decimal.js (precision:10, ROUND_HALF_UP) + Zod refine |
| NR-2 | 決済セキュリティ | Stripe Checkout Session 委譲 + Webhook署名検証 |
| NR-3 | パスワードセキュリティ | bcryptjs (saltRounds:12) + SHA-256トークンハッシュ |
| NR-4 | Redis障害時継続 | cached() ユーティリティのグレースフルデグレード |
| NR-5 | ヘルスチェック | Liveness/Readiness 分離、DB必須/Redis・Stripeオプショナル |
| NR-6 | 環境変数バリデーション | Zod起動時検証 + Stripeキープレフィックス検証 |
| NR-7 | CSP/XSS対策（設計面） | CSPヘッダー設計済（ただし未適用 → FM-037） |

---

## 6. クリティカルパス — リリース前必須修正

決済を扱うプラットフォームとして、**本番リリース前に最低限修正すべき10項目**:

| 優先度 | FM-ID | 修正内容 | RPN | 対象ファイル |
|--------|-------|---------|-----|------------|
| **1** | FM-036 | レート制限をミドルウェアに接続 | 810 | `rate-limiter.ts` → `middleware.ts` |
| **2** | FM-043 | 決済・認証フローの最低限テスト追加 | 720 | 新規テストファイル群 |
| **3** | FM-038 | 監査ログの DB INSERT 実装 + ルートに接続 | 640 | `audit-logger.ts` → 各ルート |
| **4** | FM-037 | セキュリティヘッダーをミドルウェアに接続 | 630 | `security-headers.ts` → `middleware.ts` |
| **5** | FM-034 | Stripe Webhook に冪等性チェック追加 | 448 | `order-service.ts` L132-173 |
| **6** | FM-033 | createOrder() をトランザクションでラップ | 432 | `order-service.ts` L19-126 |
| **7** | FM-031 | executeBlend() をトランザクションでラップ | 392 | `blend-service.ts` L89-227 |
| **8** | FM-022 | 注文ステータス遷移のステートマシン追加 | 336 | `order-service.ts` L220-231 |
| **9** | FM-007 | recipe-service の API ルート作成 | 336 | 新規 `app/api/v1/recipes/` |
| **10** | FM-050 | NEXT_PUBLIC_BASE_URL を env.ts に追加 | 210 | `env.ts` |

---

## 7. 推奨修正ロードマップ

### Phase α: セキュリティ基盤（即時対応）

- [ ] レート制限の Redis/インメモリ実装 + ミドルウェア接続
- [ ] セキュリティヘッダーのミドルウェア接続
- [ ] 監査ログの DB INSERT 実装 + 認証・注文ルートに接続
- [ ] INTERNAL_SERVICE_TOKEN を production で必須に
- [ ] DOMPurify インストール + ユーザー入力サニタイズ

### Phase β: データ整合性（1週間以内）

- [ ] createOrder() トランザクション化
- [ ] executeBlend() トランザクション化
- [ ] saveRulesForKeyword() トランザクション化
- [ ] updateRecipe() トランザクション化
- [ ] Stripe Webhook 冪等性チェック
- [ ] 注文ステータス遷移バリデーション

### Phase γ: 機能完成（2週間以内）

- [ ] recipe-service API ルート作成（CRUD 4エンドポイント）
- [ ] review-service API ルート作成（2エンドポイント）
- [ ] creator-profile-service 作成（CRUD）
- [ ] password-reset フロー実装
- [ ] admin 商品管理 API 作成
- [ ] NEXT_PUBLIC_BASE_URL 等の env.ts 統合

### Phase δ: 品質向上（Phase 1.5 に向けて）

- [ ] テストカバレッジ 60% 達成（決済・認証・調合を優先）
- [ ] CI に production deploy ジョブ追加
- [ ] JWT トークンブラックリスト（Redis）
- [ ] N+1 クエリ最適化（executeBlend, getRecipeDetail）
- [ ] 設計書間の不整合解消（Python AI Service 関連）
- [ ] biome.json 設定追加

---

## 8. 付録: 全50件 FMEA 一覧

| # | FM-ID | 故障モード | S | O | D | RPN | 重大度 |
|---|-------|-----------|---|---|---|-----|--------|
| 1 | FM-036 | レート制限スタブ + 未接続 | 9 | 10 | 9 | 810 | Critical |
| 2 | FM-012 | レート制限スタブ (always allows) | 9 | 10 | 9 | 810 | Critical |
| 3 | FM-043 | テストカバレッジ ~5% | 8 | 10 | 9 | 720 | Critical |
| 4 | FM-038 | 監査ログ DB INSERT TODO + 未接続 | 8 | 10 | 8 | 640 | Critical |
| 5 | FM-013 | 監査ログ DB INSERT TODO | 8 | 10 | 8 | 640 | Critical |
| 6 | FM-037 | セキュリティヘッダー未適用 | 9 | 10 | 7 | 630 | Critical |
| 7 | FM-014 | セキュリティヘッダー未接続 | 9 | 10 | 7 | 630 | Critical |
| 8 | FM-034 | Stripe Webhook 冪等性なし | 8 | 8 | 7 | 448 | Critical |
| 9 | FM-033 | createOrder() トランザクションなし | 9 | 8 | 6 | 432 | Critical |
| 10 | FM-039 | 脅威モデル文書なし | 6 | 10 | 7 | 420 | Critical |
| 11 | FM-031 | executeBlend() トランザクションなし | 7 | 8 | 7 | 392 | Critical |
| 12 | FM-022 | 注文ステータス遷移バリデーションなし | 8 | 6 | 7 | 336 | Critical |
| 13 | FM-007 | recipe-service 8関数 APIルート0 | 8 | 7 | 6 | 336 | Critical |
| 14 | FM-008 | review-service 4関数 APIルート0 | 7 | 7 | 6 | 294 | Critical |
| 15 | FM-032 | saveRulesForKeyword() トランザクションなし | 7 | 5 | 8 | 280 | Critical |
| 16 | FM-041 | DOMPurify 未インストール/未使用 | 8 | 5 | 7 | 280 | Critical |
| 17 | FM-005 | INTERNAL_SERVICE_TOKEN がoptional | 8 | 5 | 7 | 280 | Critical |
| 18 | FM-006 | CI に production deploy ジョブなし | 7 | 8 | 5 | 280 | Critical |
| 19 | FM-042 | JWT maxAge 30日 即時無効化なし | 8 | 4 | 8 | 256 | Critical |
| 20 | FM-019 | 5 DBテーブルにサービス層なし | 6 | 7 | 6 | 252 | Critical |
| 21 | FM-016 | recipe/review サービスが完全デッドコード | 5 | 10 | 5 | 250 | Critical |
| 22 | FM-011 | 16+画面にAPIバッキングなし | 7 | 7 | 5 | 245 | Critical |
| 23 | FM-040 | パスワードリセット未実装（スキーマのみ） | 6 | 8 | 5 | 240 | Critical |
| 24 | FM-035 | AI API リトライ/タイムアウトなし | 5 | 6 | 7 | 210 | Critical |
| 25 | FM-023 | executeBlend() N+1 キーワードループ | 5 | 7 | 6 | 210 | Critical |
| 26 | FM-025 | レシピ一覧 AVG(rating) 相関サブクエリ | 5 | 6 | 7 | 210 | Critical |
| 27 | FM-047 | env.ts バイパス (stripe.ts/db が process.env 直接) | 6 | 7 | 5 | 210 | Critical |
| 28 | FM-050 | NEXT_PUBLIC_BASE_URL env.ts 未登録 | 7 | 5 | 6 | 210 | Critical |
| 29 | FM-010 | password_reset_tokens サービス/APIなし | 6 | 8 | 4 | 192 | High |
| 30 | FM-026 | 3+ FK カラムにインデックスなし | 5 | 6 | 6 | 180 | High |
| 31 | FM-020 | Products 管理者CRUD なし | 6 | 6 | 5 | 180 | High |
| 32 | FM-004 | REDIS_URL docker-compose web 未設定 | 5 | 7 | 5 | 175 | High |
| 33 | FM-009 | creator_profiles/styles サービス層なし | 5 | 7 | 5 | 175 | High |
| 34 | FM-017 | Zod float vs DB integer 不整合 | 5 | 5 | 7 | 175 | High |
| 35 | FM-003 | AI 設計書 claude-sonnet-4.5 vs コード gpt-4 | 4 | 8 | 5 | 160 | High |
| 36 | FM-027 | API バージョン管理戦略未定義 | 5 | 5 | 6 | 150 | High |
| 37 | FM-024 | getRecipeDetail() 4直列クエリ | 4 | 7 | 5 | 140 | High |
| 38 | FM-048 | Stripe SDK 密結合 | 4 | 7 | 5 | 140 | High |
| 39 | FM-049 | AI client openai('gpt-4') ハードコード | 4 | 7 | 5 | 140 | High |
| 40 | FM-021 | blend_request_flavors テーブル未使用 | 4 | 7 | 5 | 140 | High |
| 41 | FM-028 | 全画面で空状態未定義 | 4 | 8 | 4 | 128 | High |
| 42 | FM-002 | 4外部システムの通信プロトコル未文書化 | 4 | 5 | 5 | 100 | High |
| 43 | FM-029 | ローディング状態未定義 | 3 | 8 | 4 | 96 | Medium |
| 44 | FM-045 | biome.json 設定ファイルなし | 3 | 8 | 3 | 72 | Medium |
| 45 | FM-001 | Sentry がコア設計書に未記載 | 3 | 6 | 4 | 72 | Medium |
| 46 | FM-030 | write-review-pro 孤立画面 | 2 | 5 | 4 | 40 | Low |
| 47 | FM-015 | IP抽出ロジック 2ファイル重複 | 2 | 6 | 3 | 36 | Low |
| 48 | FM-018 | order-service.ts 未使用 import inArray | 1 | 8 | 2 | 16 | Low |

---

## 9. レビュー実施メトリクス

| メトリクス | 値 |
|-----------|-----|
| 投入エージェント数 | 14 |
| 読取ファイル数 | 50+ |
| チェック項目数（C4） | 22 |
| 品質特性評価数（ISO） | 8特性 × 4サブ特性 |
| ATAMシナリオ数 | 8 |
| FMEA 故障モード数 | 50 |
| 所要時間 | 約20分（4フェーズ並列実行） |

---

*Generated by KARF v1.0 — KyaraInnovate Architecture Review Framework*
*Review date: 2026-02-17*
