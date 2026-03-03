# KyaraInnovate 脅威モデル（STRIDE分析）

> FM-039（RPN=420）への対応として、STRIDE脅威分析およびOWASP Top 10対応表を作成する。

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 作成日 | 2026-02-17 |
| 対象範囲 | Phase 1 ～ Phase 3 の全コンポーネント |

---

## 1. STRIDE脅威モデル

### 1.1 概要

STRIDE（Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege）の各脅威カテゴリに対して、KyaraInnovate の脅威と対策を整理する。

### 1.2 脅威分析一覧

| STRIDE | 脅威 | 影響度 | 対策 | ステータス |
|--------|------|--------|------|----------|
| **Spoofing（なりすまし）** | JWT偽造によるセッションハイジャック | 高 | AUTH_SECRET 32+文字、JWTトークン署名検証（Auth.js v5） | 実装済 |
| Spoofing | パスワードブルートフォース | 高 | レート制限（5回/分）、bcryptjs (saltRounds=12) | 設計済・未接続（レート制限） |
| Spoofing | Webhook偽装（Stripe以外からの呼出） | 高 | Stripe署名検証（`stripe.webhooks.constructEvent`） | 実装済 |
| **Tampering（改ざん）** | リクエストパラメータ改ざん（価格、数量） | 高 | Zodバリデーション（全Server Action）、サーバーサイド価格再計算 | 実装済 |
| Tampering | 注文ステータス不正遷移 | 中 | `validateStatusTransition()` ガード関数 + DB制約 | 設計済（[cart-checkout-orders.md §11](./features/cart-checkout-orders.md)） |
| Tampering | 調合比率の改ざん | 中 | サーバーサイド計算（Decimal.js）、クライアント値を信用しない | 実装済 |
| **Repudiation（否認）** | 管理者操作の否認 | 中 | 監査ログ（`audit_logs` テーブル） | 設計済・未接続（[auth-user-management.md §11](./features/auth-user-management.md)） |
| Repudiation | 決済操作の否認 | 高 | Stripe Webhookログ + `processed_webhook_events` テーブル | 設計済（[cart-checkout-orders.md §10](./features/cart-checkout-orders.md)） |
| Repudiation | ユーザー操作の否認 | 低 | Auth.js セッション + IP記録（監査ログ） | 設計済・未接続 |
| **Information Disclosure（情報漏洩）** | PII漏洩（Sentryログ経由） | 高 | Sentryフィルタ設定（`beforeSend` でPII除去） | 実装済 |
| Information Disclosure | エラーメッセージによる内部情報露出 | 中 | 本番環境でのスタックトレース非表示、汎用エラーメッセージ | 実装済 |
| Information Disclosure | APIレスポンスでの過剰データ返却 | 中 | TypeScript型定義による返却フィールド制限 | 実装済 |
| Information Disclosure | ログへのパスワード/トークン出力 | 高 | ログredact設定（password, token, secret フィールド） | 実装済 |
| **Denial of Service（サービス拒否）** | APIエンドポイントへのリクエスト洪水 | 高 | レート制限（Redis + Sliding Window） | 設計済・未接続（[auth-user-management.md §11](./features/auth-user-management.md)） |
| Denial of Service | AI API呼出しによるリソース枯渇 | 中 | ユーザーあたり10回/日の調合リクエスト制限 | 設計済 |
| Denial of Service | 大量ファイルアップロード | 中 | ファイルサイズ制限（5MB/10MB）、MIMEタイプ検証 | 設計済 |
| **Elevation of Privilege（権限昇格）** | ロール昇格（CUSTOMER→ADMIN） | 高 | RBAC middleware（3層アクセス制御） | 実装済 |
| Elevation of Privilege | 他ユーザーのリソースアクセス | 高 | 全Server ActionでuserIdチェック | 実装済 |
| Elevation of Privilege | INTERNAL_SERVICE_TOKEN漏洩 | 高 | `.min(32)` 必須化、環境変数管理 | 設計済（[auth-user-management.md §10](./features/auth-user-management.md)） |

---

## 2. OWASP Top 10 対応表（2021年版）

| # | 脆弱性 | 対策 | ステータス | 関連設計書 |
|---|--------|------|----------|-----------|
| A01 | Broken Access Control | 3層RBAC（middleware→Server Action→Component）、userId所有権チェック | 実装済 | [auth-user-management.md §7](./features/auth-user-management.md) |
| A02 | Cryptographic Failures | bcryptjs (saltRounds=12)、JWT署名 (AUTH_SECRET 32+)、HTTPS強制 | 実装済 | [auth-user-management.md §7.1-7.2](./features/auth-user-management.md) |
| A03 | Injection | Drizzle ORMパラメータ化クエリ、Zodバリデーション、DOMPurify（UGC） | 実装済 | [auth-user-management.md §7.9](./features/auth-user-management.md) |
| A04 | Insecure Design | 本脅威モデル、FMEA 50項目レビュー | 対応中 | 本書 |
| A05 | Security Misconfiguration | `env.ts` 起動時バリデーション、セキュリティヘッダー | 一部未接続 | [operations-infrastructure.md §7](./features/operations-infrastructure.md) |
| A06 | Vulnerable and Outdated Components | Dependabot自動PR、`npm audit` CI統合 | 設計済 | [operations-infrastructure.md](./features/operations-infrastructure.md) |
| A07 | Identification and Authentication Failures | Auth.js v5、JWT即時無効化（token_blacklist）、レート制限 | 一部未接続 | [auth-user-management.md §9](./features/auth-user-management.md) |
| A08 | Software and Data Integrity Failures | Stripe Webhook署名検証、NPM lockfile-lint | 実装済 | [cart-checkout-orders.md §10](./features/cart-checkout-orders.md) |
| A09 | Security Logging and Monitoring Failures | Sentry統合、監査ログ、ヘルスチェックAPI | 一部未接続 | [operations-infrastructure.md §2](./features/operations-infrastructure.md) |
| A10 | Server-Side Request Forgery (SSRF) | 外部URL入力なし（ファイルアップロードのみ）、AI APIは固定URL | リスク低 | — |

---

## 3. 残存リスク評価

### 3.1 未対策リスク

| リスク | 影響度 | 発生可能性 | 対応予定 | 備考 |
|--------|--------|-----------|---------|------|
| DDoS（L3/L4レベル） | 高 | 低 | Phase 2 | Vercel/Cloudflare CDN のDDoS保護に依存 |
| ゼロデイ脆弱性 | 高 | 低 | 継続 | Dependabot + 定期パッチ適用で軽減 |
| ソーシャルエンジニアリング | 中 | 中 | 対象外 | 技術的対策の範囲外 |
| 内部犯行（管理者不正操作） | 中 | 低 | Phase 2 | 監査ログ接続後に監視体制構築 |

### 3.2 リスク受容基準

| リスクレベル | RPN範囲 | 対応 |
|-------------|---------|------|
| Critical | 500+ | 即時対応（Phase 1 リリース前） |
| High | 300-499 | Phase 1 完了後、Phase 2 開始前に対応 |
| Medium | 100-299 | Phase 2 で対応 |
| Low | 1-99 | バックログとして管理 |

### 3.3 セキュリティコンポーネント接続ロードマップ

| コンポーネント | 現状 | 接続予定 | 担当 |
|-------------|------|---------|------|
| レートリミッター（`lib/rate-limit.ts`） | 設計済・コード存在 | Phase 1 Sprint 3 | middleware.ts 統合 |
| 監査ログ（`lib/audit-logger.ts`） | 設計済・コード存在 | Phase 1 Sprint 3 | 全Server Action統合 |
| セキュリティヘッダー（`lib/security-headers.ts`） | 設計済・コード存在 | Phase 1 Sprint 2 | middleware.ts 統合 |
| JWT即時無効化（`token_blacklist`） | 設計済 | Phase 1 Sprint 3 | マイグレーション + auth.ts 統合 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | 初版作成（FMEA FM-039 対応） |

---

*最終更新: 2026年2月17日*
