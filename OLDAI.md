# KyaraInnovate - カスタム香水ECサイト

> **注意**: このシステムは第三者が作成したものであり、本ドキュメントはソースコード分析に基づく記録です。

## 概要

ユーザーがオリジナルの香水（ディフューザー）を作成・注文できるECサイト。
AIがユーザーの好みのキーワードから香りのレシピ（香料の配合比率）を提案する機能を持つ。

- **運営元**: キャライノベイト
- **バージョン**: 0.1.0
- **フレームワーク**: Django + Django Oscar（EC基盤）

---

## システム構成

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│   ユーザー    │────▶│  Django Web App   │────▶│  外部 AI API   │
│  (ブラウザ)   │◀────│  (Oscar EC基盤)   │◀────│  (香り判定)    │
└─────────────┘     └──────────────────┘     └───────────────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL  │
                    │  + Redis     │
                    └─────────────┘
```

### 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | Python 3.11 |
| Webフレームワーク | Django 3.2 |
| ECフレームワーク | Django Oscar 3.1 |
| API | Django REST Framework |
| データベース | PostgreSQL 15 |
| キャッシュ/キュー | Redis 7 + Celery |
| 決済 | PayPal (django-oscar-paypal) |
| フォーム | django-crispy-forms (Bootstrap4) |
| 認証 | django-allauth + Oscar EmailBackend |
| 検索 | django-haystack (SimpleEngine) |
| コンテナ | Docker + docker-compose |

---

## ディレクトリ構成

```
aisent/
├── .env                          # 環境変数
├── manage.py                     # Django管理コマンド
├── Dockerfile                    # Python 3.11-slim ベース
├── docker-compose.yml            # web / db / redis の3サービス
├── requirements.txt              # Python依存パッケージ
├── config/                       # プロジェクト設定
│   ├── urls.py                   # ルートURL定義
│   ├── wsgi.py                   # WSGI設定
│   ├── celery_app.py             # Celery設定
│   └── settings/
│       ├── base.py               # 共通設定
│       └── local.py              # 開発用設定 (DEBUG=True)
├── kyarainnovate_main_system/    # アプリケーションコード
│   ├── kyarainnovate_main/       # メイン機能（香水作成・AI判定）
│   │   ├── models.py             # 香料・レシピ・ディフューザー等のモデル
│   │   ├── views.py              # 主要画面のビュー
│   │   ├── forms.py              # フォーム定義
│   │   ├── urls.py               # URL定義
│   │   ├── api/                  # REST API
│   │   │   ├── serializers.py
│   │   │   └── views.py
│   │   └── judgement/
│   │       └── judge.py          # AI API呼び出しロジック
│   ├── users/                    # ユーザー認証・プロフィール
│   ├── catalogue/                # 商品カタログ（Oscar拡張）
│   │   └── helpers.py            # ディフューザー生成・価格計算
│   ├── order/                    # 注文管理
│   ├── checkout/                 # 購入フロー
│   ├── payment/                  # 決済処理
│   ├── shipping/                 # 配送管理
│   ├── dashboard/                # 管理画面
│   │   ├── catalogue/
│   │   ├── orders/
│   │   ├── users/
│   │   ├── contacts/
│   │   ├── communications/
│   │   ├── partners/
│   │   └── shipping/
│   ├── address/                  # 住所管理
│   ├── communication/            # コミュニケーション
│   ├── contact/                  # 問い合わせ
│   ├── core/                     # 基盤（TimeStampedModel, UUID）
│   ├── customer/                 # 顧客管理
│   ├── partner/                  # パートナー管理
│   ├── contrib/                  # 補助アプリ
│   ├── utils/                    # ユーティリティ
│   ├── templates/                # HTMLテンプレート (98ファイル)
│   ├── static/                   # 静的ファイル (CSS/JS/画像)
│   ├── static_src/               # ソース静的ファイル
│   └── media/                    # アップロードメディア
└── kyaradatatest_20              # データファイル (~1.7MB)
```

### ファイル統計

| 種類 | ファイル数 |
|------|-----------|
| Python (.py) | 約207 |
| HTML (.html) | 約98 |
| JavaScript (.js) | 約77 |
| CSS (.css) | 約27 |

---

## 主要機能

### 1. AI香りレシピ提案 (MyFragranceSearch)

ユーザーのキーワード入力からAIが香料の配合比率を自動生成する。

**入力**:
| 項目 | 内容 | 入力方式 |
|------|------|---------|
| 季節イメージ | 春/夏/秋/冬 | 選択式 + 重み(0-10) |
| 場所イメージ | まろやか/さわやか/ナチュラル/陽気/優雅/高級 | 選択式 + 重み(0-10) |
| 自由ワード | 任意のキーワード（最大8個） | 自由入力 + 重み(0-10) |
| モデル選択 | 12種類 or 26種類 | 切り替え |

**出力**: トップ/ミドル/ラストノートごとの香料と配合比率

**処理フロー**:
1. Django → 外部AI APIへPOSTリクエスト（judge.py）
2. AI APIが非同期で処理（ステータス: incomplete → complete）
3. Django がGETでポーリングして結果取得

### 2. 手動レシピ作成 (MyFragranceCreate)

ユーザーが香料を直接選択してレシピを作成する。

**配合比率ルール**:
- トップノート: 30%
- ミドルノート: 60%
- ラストノート: 10%

### 3. レシピ編集 (MyFragranceUpdate)

AI提案・手動作成いずれのレシピも編集可能。

**許容範囲**:
- トップ: 30〜40%
- ミドル: 50〜60%
- ラスト: 10〜15%
- 合計: 100%

### 4. ディフューザー注文 (MyFragranceOrder → DiffuserCreate)

```
レシピ選択 → ボトル選択 → オプション選択 → カート → 購入
                           ├─ キャップ（高価版/廉価版）
                           ├─ スティック
                           ├─ ラベル
                           └─ パッケージ（任意）
```

**価格体系**:
| ボトルタイプ | ベース価格 | オプション |
|-------------|-----------|-----------|
| 高価版 | 4,000円 | キャップ/スティック/ラベル/パッケージ選択 |
| 廉価版 | 3,000円 | キャップ/スティック/ラベル/パッケージ選択 |
| 詰替え用 | 5,000円 | オプションなし（直接カートへ） |

パッケージ追加時: +500円（+パッケージ商品の価格）

### 5. 単品購入 (BuyBottle)

キット、香料、オプションパーツ、スティックの単品購入。

---

## データモデル

### メイン機能 (kyarainnovate_main/models.py)

| モデル | 用途 |
|--------|------|
| **MyFragrance** | ユーザー作成のフレグランスレシピ（名前、ステータス、メモ、評価） |
| **BasicFlavor** | 香料マスタ（名前、ノート種別: トップ/ミドル/ラスト、容量、価格） |
| **BasicBottle** | ボトルマスタ（高価版/廉価版/詰替え用） |
| **BasicCap** | キャップマスタ（高価版/廉価版） |
| **BasicStick** | スティックマスタ |
| **BasicLabel** | ラベルマスタ |
| **BasicKit** | キットマスタ |
| **OptionParts** | オプションパーツマスタ |
| **InputImage** | AI入力データ（キーワード、重み、季節/場所フラグ） |
| **OutputImage** | AI出力データ（香料、配合比率、ノート種別） |
| **Diffuser** | ディフューザー注文（レシピ+ボトル+オプションの組み合わせ） |
| **Package** | パッケージマスタ |

### ユーザー (users/models.py)

| モデル | 用途 |
|--------|------|
| **User** | カスタムユーザー（UUID主キー、メール認証、姓名+ふりがな） |
| **UserProfile** | プロフィール（郵便番号、都道府県、市区町村、番地、電話番号） |
| **Payment** | 決済情報 |

### 商品 (catalogue/)

| モデル | 用途 |
|--------|------|
| **ProductSet** | バンドル商品セット |
| **ProductSetQuantity** | セット内の商品数量 |

全モデル共通: UUID主キー、作成日時/更新日時の自動記録（TimeStampedModel）

---

## 香料データ

### 12種類モデル
レモン、ベルガモット、グレープフルーツ、ダマスククラシックローズ、ミュゲ、ガーデニア、マグノリア、カシス、アッサムティ、サンダルウッド、アンバー、ムスク

### 26種類モデル
ライム、グレープフルーツ、レモン、オレンジ、ベルガモット、シーブルー、アッサムティ、カシス、ラベンダー、ダフネ、ミュゲ、マグノリア、ガーデニア、チュベローズ、ジャスミン、カーネーション、スウィートローズ、ダマスククラシックローズ、ブラックペッパー、パチュリ、シダーウッド、サンダルウッド、レザー、アンバー、ムスク、バニラ

---

## 外部AI API (AI_API_ENDPOINT)

### 概要

`settings.AI_API_ENDPOINT` に設定されるURLの外部サービス。
**このリポジトリには含まれていない。**

### エンドポイント

| メソッド | パス | 用途 |
|---------|------|------|
| POST | `/my-fragrance/` | レシピ生成リクエスト |
| GET | `/my-fragrance/{pk}/` | 生成結果の取得 |

### リクエスト形式 (POST)

```json
{
  "pk": "uuid",
  "name": "フレグランス名",
  "word_list": [
    {"word": "秋", "rate": 8},
    {"word": "優雅", "rate": 7}
  ],
  "model_type": "12",
  "FLAVORS": [
    {"id": "uuid", "label": "レモン"},
    {"id": "uuid", "label": "ベルガモット"}
  ]
}
```

### レスポンス形式 (GET)

```json
{
  "is_searched": "complete",
  "model_type": "12",
  "output_images": [
    {"flavor": "uuid", "volume": 0.15, "perfume_note": "top"},
    {"flavor": "uuid", "volume": 0.30, "perfume_note": "middle"}
  ]
}
```

### 現状

`.env` の `AI_API_ENDPOINT` が空のため、AI機能は動作しない。
手動レシピ作成機能は AI なしで動作可能。

---

## 環境構築

### 前提条件

- Docker / Docker Compose

### 起動手順

```bash
# ビルド&起動
docker compose up --build

# DB初期化（別ターミナル）
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

### 環境変数 (.env)

| 変数 | 用途 | デフォルト |
|------|------|-----------|
| DJANGO_SETTINGS_MODULE | 設定モジュール | config.settings.local |
| DJANGO_SECRET_KEY | Djangoシークレットキー | dev-secret-key-change-in-production |
| POSTGRES_DB | DB名 | kyarainnovate |
| POSTGRES_USER | DBユーザー | postgres |
| POSTGRES_PASSWORD | DBパスワード | postgres |
| POSTGRES_HOST | DBホスト | db |
| POSTGRES_PORT | DBポート | 5432 |
| CELERY_BROKER_URL | Celeryブローカー | redis://redis:6379/0 |
| CELERY_RESULT_BACKEND | Celery結果バックエンド | redis://redis:6379/0 |
| AI_API_ENDPOINT | AI APIのURL | (空) |

### Docker構成

| サービス | イメージ | ポート |
|---------|---------|--------|
| web | Python 3.11-slim (Dockerfile) | 8000 |
| db | postgres:15 | - |
| redis | redis:7-alpine | 6379 |

---

## URL一覧

### メイン機能

| パス | ビュー | 機能 |
|------|--------|------|
| `/` | HomeView | ホーム画面 |
| `/about_fragrance/` | TemplateView | フレグランスについて |
| `/bottle_list/` | BuyBottleView | 単品購入 |
| `/my-fragrance/` | MyFragranceListView | レシピ一覧 |
| `/my-fragrance/search/` | MyFragranceSearchView | AI検索 |
| `/my-fragrance/create/` | MyFragranceCreateView | 手動作成 |
| `/my-fragrance/<uuid>/` | MyFragranceDetailView | レシピ詳細 |
| `/my-fragrance/<uuid>/update/` | MyFragranceUpdateView | レシピ編集 |
| `/my-fragrance/<uuid>/order/` | MyFragranceOrderView | ボトル選択 |
| `/my-fragrance/<uuid>/order/<bottle>` | MyFragranceDiffuserCreateView | オプション選択 |
| `/my-fragrance/<uuid>/delete/` | MyFragranceDeleteView | レシピ削除 |

### その他

| パス | 機能 |
|------|------|
| `/admin/` | Django管理画面 |
| `/contact/` | 問い合わせ |
| Oscar標準URL | カート・チェックアウト・アカウント等 |

---

## 備考

- 全ページがログイン必須（LoginRequiredMixin）
- 決済はコード上 Stripe の痕跡があるが、コメントアウトされており、現在は Oscar + PayPal 構成
- `kyaradatatest_20` ファイル（約1.7MB）の用途は不明
- Oscar の管理画面（Dashboard）が大幅にカスタマイズされている

---

*本ドキュメントはソースコード分析に基づき 2026-02-10 に作成*
