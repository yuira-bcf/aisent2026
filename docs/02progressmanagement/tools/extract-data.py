#!/usr/bin/env python3
"""
extract-data.py - 既存HTMLファイルからSQLデータを抽出し、dashboard.html用のSQL INSERT文を生成する。
Python標準ライブラリのみ使用。
"""

import re
import json
from html.parser import HTMLParser


# =============================================================================
# 1. design-review-tasks.html のJS配列データ
# =============================================================================

BLOCKERS = [
    {"id":"B-01","title":"注文ステータスのステートマシンが矛盾 — 2つの互換性のないステートマシンが共存（9ステータス vs 5ステータス）、大文字/小文字も不統一","category":"consistency","target":"cart-checkout-orders.md","effort":"半日","status":"completed","order":1},
    {"id":"B-02","title":"password_reset_tokens テーブル定義が3箇所で矛盾 — 生値保存 vs SHA-256ハッシュ保存 vs 生値クエリ","category":"consistency","target":"auth-user-management.md","effort":"1時間","status":"completed","order":3},
    {"id":"B-03","title":"ノート比率のデフォルト値(TOP30/MID40/LAST30)が許容範囲(TOP30-40/MID50-60/LAST10-15)に違反","category":"validation","target":"blend-system.md","effort":"1時間","status":"completed","order":4},
    {"id":"B-04","title":"ロイヤリティティアシステムが3つ定義 — 4ティア(ec-settings) vs 5ティア(creator-system) vs 未定義(実装計画書)","category":"consistency","target":"ec-settings.md, creator-system.md, 06_実装計画書.md","effort":"半日","status":"completed","order":5},
    {"id":"B-05","title":"テーブル名不一致: shipping_addresses（コア設計書）vs addresses（shipping-address.md）","category":"schema","target":"shipping-address.md, 01-04設計書","effort":"半日","status":"completed","order":2},
    {"id":"B-06","title":"ロール名不一致: USER（ec-settings.md）vs CUSTOMER（他全ドキュメント）","category":"consistency","target":"ec-settings.md","effort":"半日","status":"completed","order":2},
    {"id":"B-07","title":"product_variants テーブルが未定義 — cart_items, order_items, receipt の JOIN 先がスキーマなし","category":"schema","target":"recipe-system.md, cart-checkout-orders.md","effort":"2時間","status":"completed","order":6},
    {"id":"B-08","title":"recipe-system.md が実装不可能 — DBスキーマ5テーブル未定義、レスポンス型なし、バリデーションなし、エラーコードなし","category":"docs","target":"recipe-system.md","effort":"1日","status":"completed","order":7},
    {"id":"B-09","title":"notification-system.md が設計未完了 — 実装コードなし、APIなし、Drizzleスキーマなし、コンポーネントなし、メール配信停止未対応","category":"docs","target":"notification-system.md","effort":"1日","status":"completed","order":8},
]

SUPPLEMENTS = [
    {"id":"C-01","title":"Phase 2/3 Server ActionのZodスキーマ未定義（updateCreatorProfile, createOrder等のdataが不明）","category":"api","group":"情報の十分性","target":"02_基本設計書.md","status":"completed","resolution":"API RouteでZod検証済み。Server Actionsは/lib/validations/のスキーマをimport。パターン統一確認済み。"},
    {"id":"C-02","title":"Phase 3 画面（注文確認、注文履歴、配送先管理等 8画面）のワイヤーフレームなし","category":"ux","group":"情報の十分性","target":"02_基本設計書.md","status":"completed","resolution":"mockup-mobile.html に67画面実装済み（注文確認・履歴・配送先等すべて含む）。"},
    {"id":"C-03","title":"Stripe統合: Checkout Sessions vs Payment Intents 未決定、Webhook イベント型の列挙なし","category":"api","group":"情報の十分性","target":"01_要件定義書.md, cart-checkout-orders.md","status":"completed","resolution":"Checkout Sessions採用（order-service.ts）。Webhook: checkout.session.completed / expired を処理。要件書も更新済み。"},
    {"id":"C-04","title":"orders テーブルに updated_at, delivered_at, cancelled_at カラムなし — ステータス監査証跡不能","category":"schema","group":"情報の十分性","target":"01_要件定義書.md","status":"completed","resolution":"commerce.ts に updated_at, delivered_at を追加。cancelled_at は既存。order-service.ts のステータス更新時に自動設定。"},
    {"id":"C-05","title":"クーポンシステムが cart-checkout-orders.md で参照されているが coupon-promotion.md と未接続","category":"consistency","group":"情報の十分性","target":"cart-checkout-orders.md","status":"completed","resolution":"coupon-service.ts で validateCoupon→applyCoupon 完全統合。cart-view.tsx→order-service.ts の全フロー接続確認済み。"},
    {"id":"C-06","title":"blend-system.md, cart-checkout-orders.md に REST APIエンドポイント定義なし（Server Actionのみ）","category":"api","group":"情報の十分性","target":"blend-system.md, cart-checkout-orders.md","status":"completed","resolution":"77 REST APIエンドポイントが /app/api/v1/ に実装済み。blend 7件、cart 4件、orders 6件、coupons 5件。"},
    {"id":"C-07","title":"ADMIN ユーザー作成手順未定義（サインアップは CUSTOMER/CREATOR のみ許可）","category":"security","group":"情報の十分性","target":"auth-user-management.md","status":"completed","resolution":"seed.ts に admin@kyarainnovate.com の初期ADMINユーザー追加。既存の PATCH /admin/users/:id/role でロール変更も可能。"},
    {"id":"C-08","title":"メール送信の具体仕様（テンプレート内容、トリガー条件、送信元アドレス）全般未定義","category":"api","group":"情報の十分性","target":"全体","status":"completed","resolution":"notification-system.md §5/§9 で完全定義。Resend + React Email、8テンプレート、送信元 noreply@kyarainnovate.com。"},
    {"id":"C-09","title":"creator_stats テーブルのフルスキーマ定義なし（ER図参照のみ）","category":"schema","group":"情報の十分性","target":"creator-system.md","status":"completed","resolution":"creator-profiles.ts にフルスキーマ定義済み: tier, tierScore, recipeSalesCount, avgRating, repeatRate等11カラム。"},
    {"id":"C-10","title":"画像アップロード先（Vercel Blob / S3）未決定","category":"infra","group":"情報の十分性","target":"operations-supplement.md, ec-shop.md","status":"deferred","resolution":"DBスキーマ (avatar_url, image_url) は準備済み。ストレージサービスの選定はデプロイ環境決定後に実施。"},
    {"id":"C-11","title":"01_要件定義書の本文に Java 21 / Spring Boot の記述が残存（全体は Next.js 移行済み）","category":"docs","group":"曖昧さの検出","target":"01_要件定義書.md","status":"completed","resolution":"技術制約セクションを実際のスタック（Next.js 15, Tailwind v4, Drizzle ORM, Stripe, Resend）に全面更新。"},
    {"id":"C-12","title":"AIモデル参照: ヘッダーで廃止通知しながら本文に OpenAI/GPT-4/OPENAI_API_KEY が散在","category":"docs","group":"曖昧さの検出","target":"01/02/03_設計書","status":"completed","resolution":"01/02設計書は廃止通知済み。creator-system.md にも廃止通知を追加。hybrid-blend-architecture.md への参照完備。"},
    {"id":"C-13","title":"「クレジットカード等」「SendGrid等」「クラウド（本番）」— 外部サービスの最終決定が要件書に未反映","category":"docs","group":"曖昧さの検出","target":"01_要件定義書.md","status":"completed","resolution":"01_要件定義書.md の技術制約を更新: Stripe (Checkout Sessions), Resend + React Email, Vercel + クラウド。"},
    {"id":"C-14","title":"ロイヤリティ率「売上の10-30%, クリエーターランクに応じて変動」— ランク定義なし、計算式なし","category":"validation","group":"曖昧さの検出","target":"01_要件定義書.md","status":"completed","resolution":"creator-system.md §7 で完全定義: 5ティア(APPRENTICE 10%→GRAND_MASTER 20%)、スコア計算式5指標、昇格閾値。"},
    {"id":"C-15","title":"プリセットキーワード数: 01は「12件」、02は16件列挙 — 矛盾","category":"consistency","group":"曖昧さの検出","target":"01/02_設計書","status":"completed","resolution":"01_要件定義書.md を「16件（季節4、場所3、気分9）」に更新。seed.ts の実装値と一致。"},
    {"id":"C-16","title":"Zodスキーマと DB制約の不整合: name min(1) だが DB は VARCHAR(100) — 200文字でZod通過→DB失敗","category":"validation","group":"曖昧さの検出","target":"03_詳細設計書.md 全般","status":"completed","resolution":"Zod max値はDB制約以内 (例: displayName max(50) ≤ DB varchar(100), name max(100) = DB varchar(100))。整合性確認済み。"},
    {"id":"C-17","title":"NoteRatioSlider の範囲制約(TOP 30-40%等)と Zod スキーマ min(0).max(100) が矛盾","category":"validation","group":"曖昧さの検出","target":"03_詳細設計書.md","status":"completed","resolution":"UIスライダー範囲はデフォルト推奨値。APIは0-100を受容しrefineで合計100%を検証。クリエイター毎にカスタマイズ可能な設計意図。"},
    {"id":"C-18","title":"review-system.md にZodスキーマが2つ（S2.3 vs S11.3）— フィールド名が異なる","category":"consistency","group":"曖昧さの検出","target":"review-system.md","status":"completed","resolution":"実装は review-service.ts に1つのみ (createReviewSchema)。設計書の重複は実装に影響なし。"},
    {"id":"C-19","title":"creator-system.md にupdateProfileSchemaが2つ（S3.3 vs S10.3）— ルールが異なる","category":"consistency","group":"曖昧さの検出","target":"creator-system.md","status":"completed","resolution":"実装は updateProfileSchema と updateStyleSchema の2つで役割が異なる（プロフィール vs スタイル設定）。意図的な分離。"},
    {"id":"C-20","title":"金額カラム名: orders.total / orders.totalYen / orders.total_yen が混在","category":"consistency","group":"曖昧さの検出","target":"receipt-invoice.md, admin-dashboard.md","status":"completed","resolution":"実装統一済み: コード上 totalYen、DB上 total_yen。Drizzle ORM のキャメル→スネーク自動変換。"},
    {"id":"C-21","title":"APIパスに /api/v1/ プレフィックスありとなしが混在 — 負荷テストが存在しないエンドポイントを叩く","category":"consistency","group":"曖昧さの検出","target":"operations-supplement.md","status":"completed","resolution":"全77エンドポイントが /api/v1/ プレフィックスで統一確認済み。"},
    {"id":"C-22","title":"Redis が Phase 1.5+ なのにレート制限（Phase 1必須）が Redis依存 — Phase 1でレート制限が機能しない","category":"infra","group":"曖昧さの検出","target":"operations-infrastructure.md","status":"completed","resolution":"rate-limiter.ts はインメモリ sliding window 実装。Redis不要で Phase 1 から動作。4カテゴリ (GENERAL/AUTH/BLEND/PASSWORD_RESET)。"},
    {"id":"C-23","title":"排他制御: 注文の同時作成、usageCount非アトミック更新、管理者同時ステータス更新 — ロック設計なし","category":"security","group":"曖昧さの検出","target":"全体","status":"completed","resolution":"order-service.ts に db.transaction() 追加（注文+明細+カートクリアをアトミック化）。coupon usageCount は sql`+1` でアトミック更新。DB unique制約で重複防止。"},
    {"id":"C-24","title":"主キー戦略: UUID（大半）vs CUID2（ec-settings.mdのみ）の混在","category":"schema","group":"曖昧さの検出","target":"ec-settings.md","status":"completed","resolution":"全テーブルで uuid().primaryKey().defaultRandom() に統一。CUID2 の使用箇所なし。"},
    {"id":"C-25","title":"調合計算のテストベクトルが1例のみ — 5-10件の入力→期待出力の表が必要","category":"testing","group":"テスト可能性","target":"02_基本設計書.md","status":"completed","resolution":"blend-calculator-edge.test.ts を新規作成。極端な重み、精度テスト、等配分、リアルワールドシナリオ（春×さわやか、冬×高級）等13テストケースを追加。全36テストパス。"},
    {"id":"C-26","title":"Phase 2/3 の受け入れ基準（具体的な入力→期待出力）が一切なし","category":"testing","group":"テスト可能性","target":"全体","status":"completed","resolution":"testing-strategy.md §2.3/§2.4 に Phase 2 (8機能+4非機能) / Phase 3 (8機能+6非機能) の詳細受け入れ基準を追加。機能要件・非機能要件を分離し合格条件を明示。"},
    {"id":"C-27","title":"パスワード最大長未定義 — bcryptは72バイトで切り捨て、巨大文字列送信でOOMの可能性","category":"security","group":"テスト可能性","target":"auth-user-management.md","status":"completed","resolution":"全auth系Zodスキーマに .max(128) 追加: register, login, password-change, password-reset/confirm, actions/auth.ts。"},
    {"id":"C-28","title":"keywords配列、rules配列に .max() がない — 無限長の配列送信が可能","category":"validation","group":"テスト可能性","target":"blend-system.md","status":"completed","resolution":"blend/calculate: keywords .max(10), rules各配列 .max(30) を追加。"},
    {"id":"C-29","title":"パフォーマンス目標が「API応答1秒以内(AI除く)」のみ — エンドポイント別SLO, LCP/FCP/CLS, 負荷テスト基準なし","category":"testing","group":"テスト可能性","target":"01_要件定義書.md","status":"completed","resolution":"operations-supplement.md §7.6 にエンドポイント別SLOマトリクスを追加。4ティア定義 (A:200ms/B:500ms/C:2000ms/D:3000ms)、全84エンドポイントの分類、ティア分布サマリ (A:22/B:53/C:6/D:3)、違反時アクションを明示。"},
    {"id":"C-30","title":"統一エラーレスポンス形式が未定義 — auth {code,message,errors}, blend {error:string}, 他は未定義","category":"api","group":"テスト可能性","target":"全体","status":"completed","resolution":"lib/api/response.ts に統一ヘルパー実装済み: apiError, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, INTERNAL_ERROR。形式: {ok:false, error:{code,message}}。"},
]

GOOD_POINTS = [
    {"id":"G-01","text":"認証・認可設計が最も成熟 — JWT設計、3層アクセス制御マトリクス、ミドルウェアルートマッチング、Zodバリデーション正規表現まで実装可能レベル"},
    {"id":"G-02","text":"KARF（アーキテクチャレビューフレームワーク）— C4+ISO25010+FMEA+ATAMの4手法ハイブリッドは個人開発として異例の品質管理水準"},
    {"id":"G-03","text":"FMEA 50項目全件の設計書反映完了 — リスクの定量化（RPN）から設計書への反映まで一貫したトレーサビリティ"},
    {"id":"G-04","text":"operations-infrastructure.md / operations-supplement.md が本番品質 — Sentry, CI/CD, バックアップ, ヘルスチェック, DR, SLO/SLI/エラーバジェット定量定義あり"},
    {"id":"G-05","text":"トランザクション設計が明示的 — executeBlend(), saveRulesForKeyword(), createOrder() の全てに db.transaction() 境界とロールバック条件を定義"},
    {"id":"G-06","text":"Webhook冪等性設計 — processed_webhook_events テーブル + 4段処理フローは決済システムとして堅実"},
    {"id":"G-07","text":"脅威モデル（STRIDE + OWASP Top 10）— 個人開発でSTRIDE脅威分析を行っているプロジェクトは稀"},
    {"id":"G-08","text":"調合計算アルゴリズムが計算例付き — 入力値→中間計算→最終出力の具体的な数値例があり正確性検証が可能"},
    {"id":"G-09","text":"coupon-promotion.md の9段階バリデーションチェーン — 各ステップのエラーメッセージまで定義された堅実な設計"},
    {"id":"G-10","text":"admin-dashboard.md が2690行の網羅的設計 — KPI定義、SQLクエリ、SSE実装、キャッシュ戦略まで本番デプロイ可能なレベル"},
]


# =============================================================================
# 2. implementation-status.html のテーブルデータ
# =============================================================================

IMPL_FEATURES = [
    # 認証・ユーザー管理 (7件)
    {"name":"ユーザー登録","design_ref":"F-AUTH-001","category":"auth","phase":1,"page_route":"/register","api_endpoint":"POST /auth/register","status":"done","notes":""},
    {"name":"ログイン","design_ref":"F-AUTH-002","category":"auth","phase":1,"page_route":"/login","api_endpoint":"POST /auth/login","status":"done","notes":""},
    {"name":"ログアウト","design_ref":"F-AUTH-003","category":"auth","phase":1,"page_route":"レイアウト内","api_endpoint":"Server Action","status":"done","notes":""},
    {"name":"パスワードリセット","design_ref":"F-AUTH-004","category":"auth","phase":1,"page_route":"/forgot-password, /reset-password","api_endpoint":"POST /auth/password-reset/*","status":"done","notes":""},
    {"name":"ロールベースアクセス制御","design_ref":"F-AUTH-006","category":"auth","phase":1,"page_route":"middleware.ts","api_endpoint":"auth-guard.ts","status":"done","notes":""},
    {"name":"クリエーター登録申請","design_ref":"F-AUTH-007","category":"auth","phase":2,"page_route":"/creator-application","api_endpoint":"POST /creator/application","status":"done","notes":""},
    {"name":"ユーザープロフィール管理","design_ref":"F-AUTH-008","category":"auth","phase":2,"page_route":"/profile","api_endpoint":"PATCH /auth/me, PUT /auth/password","status":"done","notes":""},
    # 調合システム (9件)
    {"name":"キーワード選択","design_ref":"CUST-01","category":"blend","phase":1,"page_route":"/blend","api_endpoint":"GET /blend/keywords","status":"done","notes":""},
    {"name":"キーワード重み設定","design_ref":"CUST-02","category":"blend","phase":1,"page_route":"/blend","api_endpoint":"-","status":"done","notes":""},
    {"name":"ノート比率設定 (TOP/MID/LAST)","design_ref":"CUST-03","category":"blend","phase":1,"page_route":"/blend","api_endpoint":"-","status":"done","notes":""},
    {"name":"香料手動選択 (26種)","design_ref":"CUST-04","category":"blend","phase":1,"page_route":"/blend","api_endpoint":"GET /blend/flavors","status":"done","notes":""},
    {"name":"調合自動生成","design_ref":"CUST-05","category":"blend","phase":1,"page_route":"-","api_endpoint":"POST /blend/generate","status":"done","notes":""},
    {"name":"結果表示 (チャート・ストーリー)","design_ref":"CUST-06","category":"blend","phase":1,"page_route":"/result/[id]","api_endpoint":"GET /blend/results/[id]","status":"done","notes":""},
    {"name":"フレグランス命名","design_ref":"CUST-07","category":"blend","phase":1,"page_route":"/result/[id]","api_endpoint":"Server Action","status":"done","notes":""},
    {"name":"調合履歴閲覧","design_ref":"CUST-08","category":"blend","phase":1,"page_route":"/history","api_endpoint":"GET /blend/results","status":"done","notes":""},
    {"name":"3モード調合 (ai_only / styled / recipe)","design_ref":"Phase2 設計","category":"blend","phase":2,"page_route":"/blend (モードセレクター)","api_endpoint":"Server Action (recipeBlend)","status":"done","notes":""},
    # クリエーター機能 (13件)
    {"name":"クリエーター一覧表示","design_ref":"-","category":"creator","phase":2,"page_route":"/creators","api_endpoint":"GET /creators","status":"done","notes":""},
    {"name":"クリエーター詳細","design_ref":"-","category":"creator","phase":2,"page_route":"/creators/[slug]","api_endpoint":"GET /creators/[slug]","status":"done","notes":""},
    {"name":"クリエーター登録申請","design_ref":"CRTR-01","category":"creator","phase":2,"page_route":"/creator-application","api_endpoint":"POST /creator/application","status":"done","notes":""},
    {"name":"管理者審査 (承認/却下)","design_ref":"CRTR-02","category":"creator","phase":2,"page_route":"/admin/creators","api_endpoint":"PUT /admin/creators/[id]/review","status":"done","notes":""},
    {"name":"プロフィール編集","design_ref":"CRTR-03","category":"creator","phase":2,"page_route":"/creator/settings","api_endpoint":"GET/PUT /creator/profile","status":"done","notes":""},
    {"name":"スタイルプロファイル設定","design_ref":"CRTR-04","category":"creator","phase":2,"page_route":"/creator/settings (スタイルタブ)","api_endpoint":"GET/PUT /creator/style","status":"done","notes":""},
    {"name":"シグネチャーレシピ作成","design_ref":"CRTR-05","category":"creator","phase":2,"page_route":"/creator/recipes, /new, /[id]/edit","api_endpoint":"CRUD /creator/recipes","status":"done","notes":""},
    {"name":"レシピ一括AI提案","design_ref":"CRTR-06","category":"creator","phase":3,"page_route":"/creator/data-input/evaluation","api_endpoint":"合成レシピ評価 + 上級レシピ作成","status":"done","notes":""},
    {"name":"レシピバージョン管理","design_ref":"CRTR-07","category":"creator","phase":3,"page_route":"/history/[id]/compare","api_endpoint":"バージョン比較 + セレクター","status":"done","notes":""},
    {"name":"ダッシュボード (KPI表示)","design_ref":"CRTR-08~09","category":"creator","phase":2,"page_route":"/creator/dashboard","api_endpoint":"GET /creator/stats","status":"done","notes":""},
    {"name":"キーワード・ルール管理","design_ref":"-","category":"creator","phase":1,"page_route":"/keywords, /keywords/[id]","api_endpoint":"GET/POST /creator/keywords","status":"done","notes":""},
    {"name":"ロイヤリティ確認 (クリエーター側)","design_ref":"CRTR-13","category":"creator","phase":3,"page_route":"/creator/royalties","api_endpoint":"収益レポート + 明細表示","status":"done","notes":""},
    {"name":"お気に入りクリエーター","design_ref":"-","category":"creator","phase":2,"page_route":"/creators/[slug]","api_endpoint":"GET /creator/favorites","status":"done","notes":""},
    # EC・ショップ・決済 (11件)
    {"name":"商品一覧 (フィルタ・ソート)","design_ref":"PROD-01~03","category":"ec","phase":3,"page_route":"/shop","api_endpoint":"GET /shop/products","status":"done","notes":""},
    {"name":"商品詳細","design_ref":"PROD-04","category":"ec","phase":3,"page_route":"/shop/[id]","api_endpoint":"GET /shop/products/[id]","status":"done","notes":""},
    {"name":"お気に入り商品 (ハート)","design_ref":"PROD-05","category":"ec","phase":3,"page_route":"/shop (ハートアイコン)","api_endpoint":"POST /shop/products/[id]/favorite","status":"done","notes":""},
    {"name":"カート (追加・数量変更・削除)","design_ref":"CART-01~03","category":"ec","phase":3,"page_route":"/cart","api_endpoint":"CRUD /cart/items","status":"done","notes":""},
    {"name":"クーポン適用","design_ref":"CART-04","category":"ec","phase":3,"page_route":"/cart (クーポン入力欄)","api_endpoint":"POST /coupons/validate","status":"done","notes":""},
    {"name":"チェックアウト (5ステップ)","design_ref":"Step1~5","category":"ec","phase":3,"page_route":"/checkout","api_endpoint":"POST /orders","status":"done","notes":""},
    {"name":"注文一覧・詳細","design_ref":"-","category":"ec","phase":3,"page_route":"/orders, /orders/[id]","api_endpoint":"GET /orders","status":"done","notes":""},
    {"name":"配送先管理","design_ref":"-","category":"ec","phase":3,"page_route":"/addresses","api_endpoint":"CRUD /shipping-addresses","status":"done","notes":""},
    {"name":"Stripe Webhook","design_ref":"-","category":"ec","phase":3,"page_route":"-","api_endpoint":"POST /orders/webhook","status":"done","notes":""},
    {"name":"キャンセル・返品UI","design_ref":"注文ライフサイクル","category":"ec","phase":3,"page_route":"/orders/[id] (キャンセルボタン)","api_endpoint":"POST /orders/[id]/cancel","status":"done","notes":""},
    {"name":"メール通知 (Resend)","design_ref":"Phase3","category":"ec","phase":3,"page_route":"-","api_endpoint":"6テンプレート + 自動送信","status":"done","notes":""},
    # 管理者機能 (5件)
    {"name":"管理ダッシュボード","design_ref":"ADMN-04","category":"admin","phase":2,"page_route":"/admin/dashboard","api_endpoint":"GET /admin/dashboard","status":"done","notes":""},
    {"name":"ユーザー管理","design_ref":"ADMN-02","category":"admin","phase":2,"page_route":"/admin/users","api_endpoint":"GET /admin/users, PUT role","status":"done","notes":""},
    {"name":"注文管理","design_ref":"ADMN-03","category":"admin","phase":3,"page_route":"/admin/orders","api_endpoint":"GET /admin/orders","status":"done","notes":""},
    {"name":"クリエーター承認管理","design_ref":"ADMN-01","category":"admin","phase":2,"page_route":"/admin/creators","api_endpoint":"GET/PUT /admin/creators","status":"done","notes":""},
    {"name":"香料マスタ管理","design_ref":"ADMN-06","category":"admin","phase":2,"page_route":"/admin/flavors","api_endpoint":"CRUD /admin/flavors","status":"done","notes":""},
    # その他・非機能要件 (6件)
    {"name":"通知システム","design_ref":"Phase3","category":"other","phase":3,"page_route":"/notifications + ヘッダーバッジ","api_endpoint":"API 6本","status":"done","notes":"/notifications + ヘッダーバッジ + API 6本"},
    {"name":"レート制限","design_ref":"セキュリティ","category":"other","phase":1,"page_route":"-","api_endpoint":"-","status":"done","notes":"ログイン10回/分、リセット5回/分、調合30回/分"},
    {"name":"監査ログ記録","design_ref":"セキュリティ","category":"other","phase":1,"page_route":"-","api_endpoint":"-","status":"done","notes":"DB記録 + ログイン成功/失敗/管理操作"},
    {"name":"ヘルスチェック","design_ref":"運用","category":"other","phase":1,"page_route":"-","api_endpoint":"/api/health, /api/health/ready","status":"done","notes":""},
    {"name":"パーソナライゼーション","design_ref":"Phase4","category":"other","phase":4,"page_route":"-","api_endpoint":"-","status":"done","notes":"嗜好分析 + レシピ/クリエーターレコメンド + カルーセル"},
    {"name":"テスト (Vitest + Playwright)","design_ref":"品質","category":"other","phase":1,"page_route":"-","api_endpoint":"-","status":"partial","notes":"2ファイル (blend-calculator, api-blend)"},
]


# =============================================================================
# 3. css-comparison.html のデータ
# =============================================================================

DESIGN_TOKENS = [
    {"token_name":"--color-bg","token_category":"カラー","current_value":"#fafafa","old_value":"#f8f8f8","tailwind_eq":"bg-[#fafafa]","status":"match"},
    {"token_name":"--color-surface","token_category":"カラー","current_value":"#ffffff","old_value":None,"tailwind_eq":"bg-white","status":"match"},
    {"token_name":"--color-border","token_category":"カラー","current_value":"#e5e7eb","old_value":"#f0f0f0","tailwind_eq":"border-gray-200","status":"match"},
    {"token_name":"--color-text","token_category":"カラー","current_value":"#000000","old_value":"#111111","tailwind_eq":"text-black","status":"match"},
    {"token_name":"--color-text-secondary","token_category":"カラー","current_value":"#6b7280","old_value":"#666666","tailwind_eq":"text-gray-500","status":"match"},
    {"token_name":"--color-primary","token_category":"カラー","current_value":"#000000","old_value":None,"tailwind_eq":"bg-black","status":"match"},
    {"token_name":"--color-primary-light","token_category":"カラー","current_value":"#1f2937","old_value":"#333333","tailwind_eq":"gray-800","status":"match"},
    {"token_name":"--space-xs","token_category":"スペーシング","current_value":"4px","old_value":None,"tailwind_eq":"p-1","status":"match"},
    {"token_name":"--space-sm","token_category":"スペーシング","current_value":"8px","old_value":None,"tailwind_eq":"p-2","status":"match"},
    {"token_name":"--space-md","token_category":"スペーシング","current_value":"16px","old_value":None,"tailwind_eq":"p-4","status":"match"},
    {"token_name":"--space-lg","token_category":"スペーシング","current_value":"24px","old_value":None,"tailwind_eq":"p-6","status":"match"},
    {"token_name":"--space-xl","token_category":"スペーシング","current_value":"32px","old_value":None,"tailwind_eq":"p-8","status":"match"},
    {"token_name":"--space-2xl","token_category":"スペーシング","current_value":"48px","old_value":None,"tailwind_eq":"p-12","status":"match"},
    {"token_name":"--text-xs","token_category":"フォント","current_value":"10px","old_value":None,"tailwind_eq":"text-[10px]","status":"match"},
    {"token_name":"--text-sm","token_category":"フォント","current_value":"12px","old_value":None,"tailwind_eq":"text-xs","status":"match"},
    {"token_name":"--text-base","token_category":"フォント","current_value":"14px","old_value":None,"tailwind_eq":"text-sm","status":"match"},
    {"token_name":"--text-md","token_category":"フォント","current_value":"14px","old_value":"15px","tailwind_eq":"text-sm","status":"match"},
    {"token_name":"--text-lg","token_category":"フォント","current_value":"18px","old_value":None,"tailwind_eq":"text-lg","status":"match"},
    {"token_name":"--text-xl","token_category":"フォント","current_value":"20px","old_value":"22px","tailwind_eq":"text-xl","status":"match"},
    {"token_name":"--text-2xl","token_category":"フォント","current_value":"24px","old_value":"28px","tailwind_eq":"text-2xl","status":"match"},
    {"token_name":"--content-max-width","token_category":"レイアウト","current_value":"768px","old_value":"1200px","tailwind_eq":"max-w-3xl","status":"match"},
    {"token_name":"--sidebar-width","token_category":"レイアウト","current_value":"280px","old_value":None,"tailwind_eq":"w-72 (288px)","status":"match"},
    {"token_name":"--color-text-tertiary","token_category":"カラー","current_value":"#999999","old_value":None,"tailwind_eq":"gray-400 #9ca3af","status":"approx"},
]

CSS_CHANGES = [
    {"change_number":1,"item_name":"--color-bg","old_value":"#f8f8f8","new_value":"#fafafa","impl_equivalent":"bg-[#fafafa]"},
    {"change_number":2,"item_name":"--color-border","old_value":"#f0f0f0","new_value":"#e5e7eb","impl_equivalent":"border-gray-200"},
    {"change_number":3,"item_name":"--color-text","old_value":"#111111","new_value":"#000000","impl_equivalent":"text-black"},
    {"change_number":4,"item_name":"--color-text-secondary","old_value":"#666666","new_value":"#6b7280","impl_equivalent":"text-gray-500"},
    {"change_number":5,"item_name":"--color-primary-light","old_value":"#333333","new_value":"#1f2937","impl_equivalent":"gray-800"},
    {"change_number":6,"item_name":"--content-max-width","old_value":"1200px","new_value":"768px","impl_equivalent":"max-w-3xl"},
    {"change_number":7,"item_name":"--text-md","old_value":"15px","new_value":"14px","impl_equivalent":"text-sm (14px)"},
    {"change_number":8,"item_name":"--text-xl","old_value":"22px","new_value":"20px","impl_equivalent":"text-xl (20px)"},
    {"change_number":9,"item_name":"--text-2xl","old_value":"28px","new_value":"24px","impl_equivalent":"text-2xl (24px)"},
    {"change_number":10,"item_name":"トップバー背景","old_value":"白 (--color-surface)","new_value":"黒 (--color-primary)","impl_equivalent":"bg-black"},
    {"change_number":11,"item_name":"トップバー文字色","old_value":"黒文字","new_value":"#fff 白文字","impl_equivalent":"text-white"},
    {"change_number":12,"item_name":"トップバー高さ","old_value":"48px (md: 56px)","new_value":"56px (固定)","impl_equivalent":"h-14 (56px)"},
    {"change_number":13,"item_name":"カード角丸 .m-card","old_value":"12px","new_value":"4px","impl_equivalent":"border-radius: 4px"},
    {"change_number":14,"item_name":"ボトムナビ高さ","old_value":"80px","new_value":"56px","impl_equivalent":"auto (~52-56px)"},
    {"change_number":15,"item_name":"ボトムナビ非アクティブ色","old_value":"#bbb","new_value":"#9ca3af","impl_equivalent":"text-gray-400"},
    {"change_number":16,"item_name":"FABメニュー位置","old_value":"bottom: 96px","new_value":"bottom: 80px","impl_equivalent":"bottom-20 (80px)"},
    {"change_number":17,"item_name":"アイコンフォント + 閉じるボタン","old_value":"Material Icons / ×ボタンなし","new_value":"Material Symbols (656箇所) / ×ボタン追加","impl_equivalent":"Material Symbols / ×ボタンあり"},
]


# =============================================================================
# 4. mockup-comparison.html のデータ (63画面)
# =============================================================================

MOCKUP_SCREENS = [
    # 認証 (5件)
    {"name":"ログイン","category":"auth","status":"done","source_badges":["mockup","mobile","all"],"differences":"ソーシャルログイン未実装（Phase2想定）"},
    {"name":"ユーザー登録","category":"auth","status":"done","source_badges":["mockup","mobile","all"],"differences":"ニックネーム＋パスワード強度メーター追加。ロール選択・ステップUI・ソーシャル認証は残課題"},
    {"name":"パスワードリセット（リクエスト）","category":"auth","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"パスワードリセット（確認）","category":"auth","status":"done","source_badges":["設計書"],"differences":"—"},
    {"name":"テイスト・オンボーディング","category":"auth","status":"done","source_badges":["mobile"],"differences":"—"},
    # 調合 (6件)
    {"name":"調合リクエスト（フォーム型）","category":"blend","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"調合リクエスト（チャット型）","category":"blend","status":"done","source_badges":["all v2"],"differences":"チャット入力＋サジェスト実装済。詳細オプション類は今後対応"},
    {"name":"調合結果","category":"blend","status":"done","source_badges":["mockup","all v2"],"differences":"バージョン管理＋リファインメント実装済。差分チップ・注文ボタン・認証モーダルは残課題"},
    {"name":"調合履歴","category":"blend","status":"done","source_badges":["mockup","all v2"],"differences":"—"},
    {"name":"履歴詳細（バージョン比較）","category":"blend","status":"done","source_badges":["all v2"],"differences":"—"},
    {"name":"注文確認（調合結果から）","category":"blend","status":"done","source_badges":["mockup P3"],"differences":"—"},
    # クリエイター閲覧 (5件)
    {"name":"クリエイター一覧","category":"creator","status":"done","source_badges":["mockup","all v2"],"differences":"—"},
    {"name":"クリエイター詳細","category":"creator","status":"done","source_badges":["mockup","all v2"],"differences":"—"},
    {"name":"アワード詳細","category":"creator","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"レシピ詳細（顧客向け）","category":"creator","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"クリエイター申請","category":"creator","status":"done","source_badges":["設計書"],"differences":"—"},
    # EC (8件)
    {"name":"ショップ一覧","category":"shop","status":"done","source_badges":["mockup","mobile"],"differences":"—"},
    {"name":"商品詳細","category":"shop","status":"done","source_badges":["mobile","all v2"],"differences":"基本情報＋カート追加実装済。チャート/サイズ/レビューは残課題"},
    {"name":"カート","category":"shop","status":"done","source_badges":["mockup"],"differences":"モックアップ以上の実装（クーポン対応）"},
    {"name":"チェックアウト","category":"shop","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"注文一覧","category":"shop","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"注文詳細","category":"shop","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"配送先管理","category":"shop","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"お気に入り一覧","category":"shop","status":"done","source_badges":["mobile"],"differences":"—"},
    # クリエイターツール (10件)
    {"name":"キーワード一覧","category":"creator","status":"done","source_badges":["mockup"],"differences":"一括AI生成はPhase2想定"},
    {"name":"ルール編集","category":"creator","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"統計","category":"creator","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"ダッシュボード","category":"creator","status":"done","source_badges":["mockup P2","all v2"],"differences":"チャート系ビジュアルが不足"},
    {"name":"プロフィール設定","category":"creator","status":"done","source_badges":["mockup P2"],"differences":"設計書以上の実装。アバターアップロードのみ不足"},
    {"name":"レシピ一覧","category":"creator","status":"done","source_badges":["設計書","mobile"],"differences":"—"},
    {"name":"レシピ作成・編集","category":"creator","status":"done","source_badges":["設計書","mobile"],"differences":"—"},
    {"name":"ロイヤリティ","category":"creator","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"あしあと（フットプリント）","category":"creator","status":"done","source_badges":["mobile"],"differences":"—"},
    # データ入力 (6件)
    {"name":"データ入力ダッシュボード","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    {"name":"香料マスタ登録（L1）","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    {"name":"禁止組み合わせ（L1）","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    {"name":"相性スコア（L1・スワイプ入力）","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    {"name":"レシピ作成（5層テーマ軸版）","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    {"name":"合成レシピ評価（L3）","category":"creator","status":"done","source_badges":["creator-data"],"differences":"—"},
    # その他 (9件)
    {"name":"ホーム画面","category":"other","status":"done","source_badges":["mobile"],"differences":"主要セクション実装済。検索バー/トレンド/アクティビティは残課題"},
    {"name":"プロフィール設定","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"通知一覧","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"通知バッジ（ヘッダー）","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"通知設定","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"マイページ（メニューハブ）","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"ヘルプ","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"アプリについて","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"おすすめカルーセル","category":"other","status":"done","source_badges":["設計書"],"differences":"—"},
    # 管理 (13件)
    {"name":"管理ダッシュボード","category":"admin","status":"done","source_badges":["mockup","all v2"],"differences":"—"},
    {"name":"ユーザー管理","category":"admin","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"注文管理","category":"admin","status":"done","source_badges":["mockup"],"differences":"—"},
    {"name":"クリエイター管理","category":"admin","status":"done","source_badges":["all v2"],"differences":"—"},
    {"name":"香料マスタ管理","category":"admin","status":"done","source_badges":["設計書"],"differences":"—"},
    {"name":"商品管理","category":"admin","status":"done","source_badges":["mobile","all v2"],"differences":"CRUD＋ステータスフィルター実装済。画像管理は残課題"},
    {"name":"クーポン管理","category":"admin","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"レビュー管理","category":"admin","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"EC設定","category":"admin","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"注文詳細（管理者版）","category":"admin","status":"done","source_badges":["mobile","all v2"],"differences":"—"},
    {"name":"ベースAIルール","category":"admin","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"ルールマトリクス","category":"admin","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"キャリブレーション","category":"admin","status":"done","source_badges":["mobile"],"differences":"—"},
    # レスポンシブ (2件)
    {"name":"ボトムナビゲーション","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
    {"name":"ドロワーメニュー","category":"other","status":"done","source_badges":["mobile"],"differences":"—"},
]


# =============================================================================
# SQL生成
# =============================================================================

def escape_sql(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def generate_sql():
    lines = []

    # -- Statuses
    lines.append("-- ============= STATUSES =============")
    statuses = [
        (1,"open","Open","task","#fef2f2","#991b1b",1),
        (2,"in_progress","進行中","task","#eff6ff","#1d4ed8",2),
        (3,"completed","完了","task","#f0fdf4","#166534",3),
        (4,"deferred","保留","task","#f5f5f5","#737373",4),
        (5,"done","実装済","impl","#d1fae5","#065f46",1),
        (6,"partial","部分実装","impl","#fef3c7","#92400e",2),
        (7,"todo","未実装","impl","#fee2e2","#991b1b",3),
        (8,"match","一致","token","#d1fae5","#065f46",1),
        (9,"diff","差異","token","#fef3c7","#92400e",2),
        (10,"approx","近似","token","#dbeafe","#1e40af",3),
    ]
    for s in statuses:
        lines.append(f"INSERT INTO statuses VALUES({s[0]},{escape_sql(s[1])},{escape_sql(s[2])},{escape_sql(s[3])},{escape_sql(s[4])},{escape_sql(s[5])},{s[6]});")

    # -- Categories
    lines.append("\n-- ============= CATEGORIES =============")
    categories = [
        (1,"consistency","整合性","design_review","#fef3c7","#92400e"),
        (2,"schema","スキーマ","design_review","#dbeafe","#1e40af"),
        (3,"api","API設計","design_review","#e0e7ff","#3730a3"),
        (4,"validation","バリデーション","design_review","#fce7f3","#9d174d"),
        (5,"security","セキュリティ","design_review","#fef2f2","#991b1b"),
        (6,"ux","UX/画面","design_review","#f0fdf4","#166534"),
        (7,"testing","テスト","design_review","#f5f3ff","#5b21b6"),
        (8,"infra","インフラ","design_review","#ecfdf5","#065f46"),
        (9,"docs","ドキュメント","design_review","#f8fafc","#475569"),
        (10,"auth","認証・ユーザー管理","impl","#e0e7ff","#3730a3"),
        (11,"blend","調合システム","impl","#fce7f3","#9d174d"),
        (12,"creator","クリエーター機能","impl","#d1fae5","#065f46"),
        (13,"ec","EC・ショップ・決済","impl","#dbeafe","#1e40af"),
        (14,"admin_feat","管理者機能","impl","#fef3c7","#92400e"),
        (15,"other","その他・非機能","impl","#f3f4f6","#6b7280"),
        (20,"m_auth","認証","mockup","#e0e7ff","#3730a3"),
        (21,"m_blend","調合","mockup","#fce7f3","#9d174d"),
        (22,"m_creator","クリエイター","mockup","#d1fae5","#065f46"),
        (23,"m_shop","EC","mockup","#dbeafe","#1e40af"),
        (24,"m_admin","管理","mockup","#fef3c7","#92400e"),
        (25,"m_other","その他","mockup","#f3f4f6","#6b7280"),
    ]
    for c in categories:
        lines.append(f"INSERT INTO categories VALUES({c[0]},{escape_sql(c[1])},{escape_sql(c[2])},{escape_sql(c[3])},{escape_sql(c[4])},{escape_sql(c[5])});")

    # -- Design Tasks (Blockers)
    lines.append("\n-- ============= DESIGN TASKS (Blockers: 9件) =============")
    cat_map = {"consistency":1,"schema":2,"api":3,"validation":4,"security":5,"ux":6,"testing":7,"infra":8,"docs":9}
    status_map = {"open":1,"in_progress":2,"completed":3,"deferred":4}
    for b in BLOCKERS:
        cat_id = cat_map.get(b["category"], 1)
        st_id = status_map.get(b["status"], 1)
        lines.append(f"INSERT INTO design_tasks VALUES({escape_sql(b['id'])},'blocker',{escape_sql(b['title'])},{cat_id},NULL,{escape_sql(b['target'])},{escape_sql(b['effort'])},{st_id},NULL,{b['order']});")

    # -- Design Tasks (Supplements)
    lines.append("\n-- ============= DESIGN TASKS (Supplements: 30件) =============")
    for i, s in enumerate(SUPPLEMENTS):
        cat_id = cat_map.get(s["category"], 1)
        st_id = status_map.get(s["status"], 1)
        resolution = s.get("resolution", "")
        lines.append(f"INSERT INTO design_tasks VALUES({escape_sql(s['id'])},'supplement',{escape_sql(s['title'])},{cat_id},{escape_sql(s['group'])},{escape_sql(s['target'])},NULL,{st_id},{escape_sql(resolution)},{i+1});")

    # -- Design Tasks (Good Points)
    lines.append("\n-- ============= DESIGN TASKS (Good Points: 10件) =============")
    for i, g in enumerate(GOOD_POINTS):
        lines.append(f"INSERT INTO design_tasks VALUES({escape_sql(g['id'])},'good_point',{escape_sql(g['text'])},NULL,NULL,NULL,NULL,NULL,NULL,{i+1});")

    # -- Impl Features
    lines.append("\n-- ============= IMPL FEATURES (51件) =============")
    impl_cat_map = {"auth":10,"blend":11,"creator":12,"ec":13,"admin":14,"other":15}
    impl_status_map = {"done":5,"partial":6,"todo":7}
    section_order_map = {"auth":1,"blend":2,"creator":3,"ec":4,"admin":5,"other":6}
    for i, f in enumerate(IMPL_FEATURES):
        cat_id = impl_cat_map.get(f["category"], 15)
        st_id = impl_status_map.get(f["status"], 7)
        sec_order = section_order_map.get(f["category"], 6)
        lines.append(f"INSERT INTO impl_features(name,design_ref,category_id,phase,page_route,api_endpoint,status_id,notes,section_order) VALUES({escape_sql(f['name'])},{escape_sql(f['design_ref'])},{cat_id},{f['phase']},{escape_sql(f['page_route'])},{escape_sql(f['api_endpoint'])},{st_id},{escape_sql(f['notes'])},{sec_order});")

    # -- Design Tokens
    lines.append("\n-- ============= DESIGN TOKENS (23件) =============")
    token_status_map = {"match":8,"diff":9,"approx":10}
    for i, t in enumerate(DESIGN_TOKENS):
        st_id = token_status_map.get(t["status"], 8)
        lines.append(f"INSERT INTO design_tokens(token_name,token_category,current_value,old_value,tailwind_eq,status_id,sort_order) VALUES({escape_sql(t['token_name'])},{escape_sql(t['token_category'])},{escape_sql(t['current_value'])},{escape_sql(t['old_value'])},{escape_sql(t['tailwind_eq'])},{st_id},{i+1});")

    # -- CSS Changes
    lines.append("\n-- ============= CSS CHANGES (17件) =============")
    for c in CSS_CHANGES:
        lines.append(f"INSERT INTO css_changes(change_number,item_name,old_value,new_value,impl_equivalent,sort_order) VALUES({c['change_number']},{escape_sql(c['item_name'])},{escape_sql(c['old_value'])},{escape_sql(c['new_value'])},{escape_sql(c['impl_equivalent'])},{c['change_number']});")

    # -- Mockup Screens
    lines.append("\n-- ============= MOCKUP SCREENS (63件) =============")
    mockup_cat_map = {"auth":20,"blend":21,"creator":22,"shop":23,"admin":24,"other":25}
    for i, m in enumerate(MOCKUP_SCREENS):
        cat_id = mockup_cat_map.get(m["category"], 25)
        st_id = impl_status_map.get(m["status"], 7)
        badges_json = json.dumps(m["source_badges"], ensure_ascii=False)
        diff = m["differences"]
        lines.append(f"INSERT INTO mockup_screens(name,category_id,status_id,source_badges,mockup_specs,impl_checks,differences,sort_order) VALUES({escape_sql(m['name'])},{cat_id},{st_id},{escape_sql(badges_json)},NULL,NULL,{escape_sql(diff)},{i+1});")

    # -- Cross References (自動生成)
    lines.append("\n-- ============= CROSS REFERENCES =============")
    xref_id = 1

    # B-01 注文ステータス → 実装: チェックアウト, 注文一覧
    xrefs = [
        ("design_tasks","B-01","impl_features","6_チェックアウト","related","注文ステータス関連"),
        ("design_tasks","B-01","impl_features","7_注文一覧","related","注文ステータス関連"),
        ("design_tasks","B-01","mockup_screens","注文詳細","related","注文ステータスUI"),
        ("design_tasks","B-02","impl_features","4_パスワードリセット","related","password_reset_tokens"),
        ("design_tasks","B-03","impl_features","3_ノート比率設定","related","ノート比率デフォルト値"),
        ("design_tasks","B-04","impl_features","12_ロイヤリティ確認","related","ティアシステム"),
        ("design_tasks","B-05","impl_features","8_配送先管理","related","テーブル名不一致"),
        ("design_tasks","B-07","impl_features","1_商品一覧","related","product_variants"),
        ("design_tasks","B-08","impl_features","7_シグネチャーレシピ作成","related","recipe-system"),
        ("design_tasks","B-09","impl_features","1_通知システム","related","notification-system"),
        ("design_tasks","C-01","impl_features","7_ユーザープロフィール管理","related","Zodスキーマ"),
        ("design_tasks","C-02","mockup_screens","注文一覧","related","Phase3画面"),
        ("design_tasks","C-03","impl_features","9_Stripe Webhook","related","Stripe統合"),
        ("design_tasks","C-05","impl_features","5_クーポン適用","related","クーポンシステム"),
        ("design_tasks","C-22","impl_features","2_レート制限","related","Redis依存"),
        ("design_tasks","C-23","impl_features","6_チェックアウト","related","排他制御"),
        ("design_tasks","C-25","impl_features","5_調合自動生成","related","テストベクトル"),
    ]
    for x in xrefs:
        lines.append(f"INSERT INTO cross_references(source_table,source_id,target_table,target_id,relation_type,notes) VALUES({escape_sql(x[0])},{escape_sql(x[1])},{escape_sql(x[2])},{escape_sql(x[3])},{escape_sql(x[4])},{escape_sql(x[5])});")

    return "\n".join(lines)


if __name__ == "__main__":
    sql = generate_sql()
    print(sql)
    print(f"\n-- Total records: Blockers={len(BLOCKERS)}, Supplements={len(SUPPLEMENTS)}, GoodPoints={len(GOOD_POINTS)}, ImplFeatures={len(IMPL_FEATURES)}, Tokens={len(DESIGN_TOKENS)}, CSSChanges={len(CSS_CHANGES)}, Mockups={len(MOCKUP_SCREENS)}")
    print(f"-- Grand total: {len(BLOCKERS)+len(SUPPLEMENTS)+len(GOOD_POINTS)+len(IMPL_FEATURES)+len(DESIGN_TOKENS)+len(CSS_CHANGES)+len(MOCKUP_SCREENS)} records")
