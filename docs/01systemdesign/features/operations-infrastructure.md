# 運用インフラストラクチャ設計書

| 項目 | 内容 |
|------|------|
| 機能名 | 運用インフラストラクチャ（Operations Infrastructure） |
| バージョン | 1.0 |
| 作成日 | 2026-02-17 |
| 関連設計書 | [アーキテクチャ設計書](../04_アーキテクチャ設計書.md), [技術スタック設計書](../05_技術スタック設計書.md) |

---

## 1. 概要

KyaraInnovate プラットフォームの安定稼働・可観測性・継続的デリバリーを実現するための運用インフラストラクチャ設計書。以下の5領域をカバーする。

| 領域 | 目的 | 主要技術 |
|------|------|----------|
| エラートラッキング | 本番障害の即時検知・診断 | Sentry |
| CI/CD パイプライン | 品質ゲート付き自動デプロイ | GitHub Actions + Vercel |
| データベースバックアップ | データ損失防止・災害復旧 | pg_dump + WAL アーカイブ |
| ヘルスチェック | サービス正常性の継続監視 | API エンドポイント + 外部監視 |
| キャッシュ戦略 | レスポンス高速化・DB負荷軽減 | Redis 7 |

### 1.1 設計原則

- **段階的導入**: Phase 1 は最小構成（GitHub Actions + ヘルスチェック）で開始し、トラフィック増加に応じて拡張
- **Infrastructure as Code**: 全設定をリポジトリ管理し、環境差異を排除
- **Fail-Safe**: 監視・キャッシュが停止してもサービス本体は継続稼働
- **コスト意識**: Sentry Free Tier / Vercel Pro / Neon の無料枠を最大活用

---

## 2. エラートラッキング（Sentry）

### 2.1 導入方針

Sentry を Next.js 15 App Router に統合し、クライアント・サーバー・Edge ランタイムの全エラーを一元管理する。

### 2.2 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SENTRY_DSN` | Sentry プロジェクト DSN | 本番: 必須 / 開発: 任意 |
| `SENTRY_ORG` | Sentry 組織スラッグ | CI: 必須 |
| `SENTRY_PROJECT` | Sentry プロジェクトスラッグ | CI: 必須 |
| `SENTRY_AUTH_TOKEN` | ソースマップアップロード用トークン | CI: 必須 |

### 2.3 Next.js 統合構成

3つの設定ファイルでランタイム別にSentryを初期化する。

#### sentry.client.config.ts

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // パフォーマンスモニタリング
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // セッションリプレイ（本番のみ）
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // PII除外
  beforeSend(event) {
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

#### sentry.server.config.ts

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Server Actions / Route Handlers のトレース
  integrations: [
    Sentry.prismaIntegration(), // Drizzle互換
  ],
});
```

#### sentry.edge.config.ts

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

#### next.config.ts への統合

```typescript
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // 既存設定...
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: '/monitoring', // AdBlocker回避
});
```

### 2.4 カスタムエラーバウンダリ

```typescript
// app/global-error.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">エラーが発生しました</h1>
            <p className="mt-2 text-gray-600">
              問題が解決しない場合はサポートにお問い合わせください
            </p>
            <button
              onClick={reset}
              className="mt-4 rounded bg-primary px-4 py-2 text-white"
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

### 2.5 Server Action エラーキャプチャ

既存の `safeHandler` パターンと連携し、Server Action でも Sentry にエラーを送信する。

```typescript
// lib/api/handler.ts（拡張例）
import * as Sentry from '@sentry/nextjs';

export function safeHandler(fn: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof ZodError) {
        return VALIDATION_ERROR(error.errors[0].message);
      }
      Sentry.captureException(error, {
        extra: {
          url: req.url,
          method: req.method,
        },
      });
      console.error('[API Error]', error);
      return INTERNAL_ERROR();
    }
  };
}
```

### 2.6 アラートルール

| 優先度 | 条件 | 通知先 | 対応SLA |
|--------|------|--------|---------|
| **P1 (Critical)** | 500エラー 5分間で10件以上 | Slack #alerts-critical + PagerDuty | 15分以内に対応開始 |
| **P1 (Critical)** | ヘルスチェック連続3回失敗 | Slack #alerts-critical + PagerDuty | 15分以内に対応開始 |
| **P2 (Warning)** | トランザクション P95 > 3秒 | Slack #alerts-warning | 1時間以内に確認 |
| **P2 (Warning)** | エラーレート 1% 超過 | Slack #alerts-warning | 1時間以内に確認 |
| **P3 (Info)** | 新しいエラータイプの初回発生 | Slack #alerts-info | 翌営業日に確認 |

### 2.7 パフォーマンスモニタリング

| 環境 | トランザクションサンプリング率 | リプレイ率 |
|------|-------------------------------|-----------|
| production | 10% | セッション 10% / エラー時 100% |
| staging | 100% | 100% |
| development | 100% | 無効 |

### 2.8 ソースマップアップロード（CI）

GitHub Actions の build ステップで自動的にソースマップを Sentry にアップロードする。`withSentryConfig` が `SENTRY_AUTH_TOKEN` 環境変数を検出して自動実行する。

---

## 3. CI/CD パイプライン（GitHub Actions）

### 3.1 パイプライン概要

```
┌─────────┐    ┌───────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│  Push /  │───▶│   Lint    │───▶│Typecheck │───▶│  Test   │───▶│  Build   │
│  PR      │    │  (Biome)  │    │(tsc)     │    │(Vitest) │    │(Next.js) │
└─────────┘    └───────────┘    └──────────┘    └─────────┘    └──────────┘
                                                                     │
                    ┌────────────────────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────────────────────┐
        │                Deploy Strategy                    │
        │                                                  │
        │  PR → Vercel Preview (自動)                       │
        │  main → Staging (自動)                            │
        │  Release Tag → Production (手動承認)               │
        └──────────────────────────────────────────────────┘
```

### 3.2 トリガー

| イベント | ブランチ | 動作 |
|---------|---------|------|
| `push` | `main` | Lint → Typecheck → Test → Build → Staging デプロイ |
| `pull_request` | `main` | Lint → Typecheck → Test → Build → Preview デプロイ |
| `release` (published) | タグ `v*` | Production デプロイ（手動承認） |

### 3.3 ジョブ構成

```yaml
jobs:
  lint:        # Biome lint + format check
  typecheck:   # tsc --noEmit (Turborepo経由)
  test:        # Vitest (PostgreSQL service container)
  build:       # next build (Turborepo経由)
  deploy:      # Vercel CLI デプロイ
```

### 3.4 環境別デプロイ戦略

| 環境 | トリガー | URL | 承認 |
|------|---------|-----|------|
| Preview | PR作成/更新 | `*.vercel.app` (動的) | 不要 |
| Staging | main ブランチ push | `staging.kyarainnovate.com` | 不要 |
| Production | Release タグ | `kyarainnovate.com` | 手動承認必須 |

### 3.5 GitHub Secrets

| シークレット名 | 用途 | 設定環境 |
|---------------|------|---------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | staging / production |
| `AUTH_SECRET` | Auth.js JWT 署名キー | staging / production |
| `STRIPE_SECRET_KEY` | Stripe API シークレット | staging / production |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証 | staging / production |
| `SENTRY_DSN` | Sentry DSN | staging / production |
| `SENTRY_AUTH_TOKEN` | ソースマップアップロード | CI |
| `SENTRY_ORG` | Sentry 組織 | CI |
| `SENTRY_PROJECT` | Sentry プロジェクト | CI |
| `VERCEL_TOKEN` | Vercel CLI 認証 | CI |
| `VERCEL_ORG_ID` | Vercel 組織 ID | CI |
| `VERCEL_PROJECT_ID` | Vercel プロジェクト ID | CI |
| `RESEND_API_KEY` | メール送信 | staging / production |
| `REDIS_URL` | Redis 接続文字列 | staging / production |

### 3.6 キャッシュ戦略（CI）

| キャッシュ対象 | キー | 効果 |
|---------------|------|------|
| `node_modules` | `${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}` | npm install 省略 |
| Turborepo キャッシュ | `${{ runner.os }}-turbo-${{ github.sha }}` | ビルド差分のみ実行 |

### 3.7 ワークフローファイル

`.github/workflows/ci.yml` に定義。詳細はリポジトリ内のファイルを参照。

---

## 4. データベースバックアップ

### 4.1 バックアップ戦略

3層のバックアップ戦略でデータ保護を実現する。

```
┌─────────────────────────────────────────────────────────┐
│                  バックアップ戦略                         │
│                                                         │
│  Layer 1: 日次論理バックアップ（pg_dump）                  │
│  ├── 毎日 03:00 JST 実行                                 │
│  ├── 保持期間: 30日                                       │
│  └── 保存先: S3 / GCS                                    │
│                                                         │
│  Layer 2: ポイントインタイムリカバリ（WAL アーカイブ）       │
│  ├── 継続的 WAL ストリーミング                             │
│  ├── RPO: 最大5分のデータ損失                              │
│  └── Neon / Supabase のマネージド機能を利用                │
│                                                         │
│  Layer 3: 月次フルバックアップ                              │
│  ├── 毎月1日 02:00 JST 実行                               │
│  ├── 保持期間: 12ヶ月                                     │
│  └── 保存先: S3 Glacier / GCS Coldline                    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 日次バックアップスクリプト

```bash
#!/bin/bash
# scripts/backup-db.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="kyarainnovate_${TIMESTAMP}.sql.gz"
S3_BUCKET="s3://kyarainnovate-backups/daily"

# pg_dump + gzip
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="/tmp/${BACKUP_FILE}"

# S3アップロード
aws s3 cp "/tmp/${BACKUP_FILE}" "${S3_BUCKET}/${BACKUP_FILE}"

# ローカル一時ファイル削除
rm -f "/tmp/${BACKUP_FILE}"

# 30日以上前のバックアップ削除
aws s3 ls "${S3_BUCKET}/" | \
  awk '{print $4}' | \
  while read -r file; do
    file_date=$(echo "$file" | grep -oP '\d{8}')
    if [[ $(date -d "${file_date}" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
      aws s3 rm "${S3_BUCKET}/${file}"
    fi
  done

echo "Backup completed: ${BACKUP_FILE}"
```

### 4.3 保持ポリシー

| 種別 | 頻度 | 保持期間 | 保存先 |
|------|------|---------|--------|
| 日次バックアップ | 毎日 03:00 JST | 30日 | S3 Standard |
| 月次バックアップ | 毎月1日 02:00 JST | 12ヶ月 | S3 Glacier |
| WAL アーカイブ | 継続的 | 7日 | マネージドDB機能 |

### 4.4 リストア手順

#### 日次バックアップからのリストア

```bash
# 1. バックアップファイルのダウンロード
aws s3 cp s3://kyarainnovate-backups/daily/kyarainnovate_20260217_030000.sql.gz /tmp/

# 2. 既存データベースのドロップ（注意: データ消失）
dropdb kyarainnovate --if-exists
createdb kyarainnovate

# 3. リストア
pg_restore \
  --dbname="${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  /tmp/kyarainnovate_20260217_030000.sql.gz

# 4. マイグレーション確認
cd /path/to/kyarainnovate
npm run db:push -- --dry-run
```

#### ポイントインタイムリカバリ（PITR）

マネージドDB（Neon / Supabase）の管理コンソールから指定時刻にリカバリ。

```
1. 管理コンソール → Backups → Point-in-Time Recovery
2. 復旧先時刻を指定（例: 2026-02-17 14:30:00 JST）
3. 新しいブランチ/インスタンスとしてリストア
4. アプリケーションの DATABASE_URL を更新
5. 動作確認後、旧インスタンスを削除
```

### 4.5 バックアップ検証

| 検証項目 | 頻度 | 方法 |
|---------|------|------|
| リストア可能性テスト | 週次（毎週日曜） | Staging環境にリストア実行 |
| データ整合性チェック | 日次 | pg_dump後にレコード数比較 |
| リカバリ時間計測 | 月次 | RTO目標（30分）以内であることを確認 |

### 4.6 目標値

| 指標 | 目標 |
|------|------|
| RPO（Recovery Point Objective） | 5分（WAL アーカイブ利用時） |
| RTO（Recovery Time Objective） | 30分 |
| バックアップ成功率 | 99.9% |

---

## 5. ヘルスチェック

### 5.1 エンドポイント一覧

| パス | 種別 | 認証 | 用途 |
|------|------|------|------|
| `GET /api/health` | Liveness | 不要 | サービス生存確認（ロードバランサー） |
| `GET /api/health/ready` | Readiness | 不要 | 依存サービス含む起動完了確認 |
| `GET /api/health/detailed` | Detailed | 管理者のみ | 詳細ステータス（デバッグ用） |

### 5.2 レスポンスフォーマット

#### Liveness（/api/health）

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "uptime": 3600,
    "timestamp": "2026-02-17T12:00:00.000Z",
    "checks": {
      "database": { "status": "ok", "latency": 2 }
    }
  }
}
```

#### Readiness（/api/health/ready）

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-02-17T12:00:00.000Z",
    "checks": {
      "database": { "status": "ok", "latency": 2 },
      "redis": { "status": "ok", "latency": 1 },
      "stripe": { "status": "ok", "latency": 150 }
    }
  }
}
```

#### ステータス定義

| ステータス | 条件 |
|-----------|------|
| `ok` | 全チェック正常 |
| `degraded` | 一部チェック異常（サービス継続可能） |
| `error` | 必須チェック異常（サービス提供不可） |

### 5.3 依存サービスチェック

| サービス | チェック方法 | 必須 | タイムアウト |
|---------|------------|------|------------|
| PostgreSQL | `SELECT 1` クエリ実行 | はい | 3秒 |
| Redis | `PING` コマンド | いいえ | 2秒 |
| Stripe API | API キー検証（`/v1/balance`） | いいえ | 5秒 |

### 5.4 外部モニタリング

| ツール | 対象 | 間隔 | アラート条件 |
|--------|------|------|------------|
| UptimeRobot / Checkly | `/api/health` | 60秒 | 連続3回失敗で P1 アラート |
| UptimeRobot / Checkly | `/api/health/ready` | 300秒 | 連続2回失敗で P2 アラート |

### 5.5 実装

`apps/web/app/api/health/route.ts` および `apps/web/app/api/health/ready/route.ts` に実装。詳細はソースコード参照。

---

## 6. キャッシュ戦略（Redis）

### 6.1 導入タイミング

- **Phase 1**: キャッシュなし（DB直接アクセスで十分なトラフィック量）
- **Phase 1.5以降**: Redis 7 を導入し、以下のキャッシュレイヤーを有効化

### 6.2 キャッシュレイヤー

```
┌─────────────────────────────────────────────────┐
│              キャッシュレイヤー構成               │
│                                                 │
│  L1: Next.js Data Cache（組み込み）              │
│  ├── ISR / SSG のページキャッシュ                │
│  └── fetch() のレスポンスキャッシュ               │
│                                                 │
│  L2: Redis キャッシュ                            │
│  ├── APIレスポンスキャッシュ                      │
│  ├── セッションキャッシュ                         │
│  ├── レートリミットカウンター                     │
│  └── 調合結果キャッシュ                           │
│                                                 │
│  L3: PostgreSQL（Source of Truth）               │
│  └── 全データの永続化                             │
└─────────────────────────────────────────────────┘
```

### 6.3 キャッシュ対象と TTL

| カテゴリ | キー例 | TTL | 無効化戦略 |
|---------|--------|-----|-----------|
| セッション情報 | `aisent:session:{sessionId}` | 24時間 | ログアウト時に即時削除 |
| 調合結果 | `aisent:blend:{resultId}` | 1時間 | 結果更新時に即時削除 |
| レシピ一覧 | `aisent:recipes:list:{page}:{sort}` | 5分 | レシピ作成/更新時にパターン削除 |
| クリエータープロフィール | `aisent:creator:{creatorId}:profile` | 10分 | プロフィール更新時に即時削除 |
| 香料マスタ | `aisent:flavors:all` | 1時間 | マスタ更新時に即時削除 |
| キーワード一覧 | `aisent:keywords:all` | 1時間 | キーワード更新時に即時削除 |
| レートリミット | `aisent:rate:{userId}:{endpoint}` | 1分 | TTL による自動消滅 |
| 統計データ | `aisent:stats:{creatorId}:{period}` | 15分 | TTL による自動消滅 |
| 商品一覧 | `aisent:products:list:{page}:{filter}` | 5分 | 商品更新時にパターン削除 |

### 6.4 キー命名規約

```
aisent:{resource}:{id}:{variant}

例:
  aisent:session:abc123                    # セッション
  aisent:blend:uuid-1234                   # 調合結果
  aisent:creator:uuid-5678:profile         # クリエータープロフィール
  aisent:recipes:list:1:popular            # レシピ一覧 ページ1 人気順
  aisent:rate:uuid-user:blend-generate     # レートリミット
  aisent:products:list:1:newest            # 商品一覧 ページ1 新着順
```

### 6.5 キャッシュ無効化パターン

| パターン | 対象データ | 実装 |
|---------|----------|------|
| **Write-Through** | セッション、注文情報 | 書き込み時にDBとRedisを同時更新 |
| **Cache-Aside + TTL** | 一覧データ、統計 | 読み取り時にキャッシュミスなら DB → Redis に保存 |
| **即時削除** | プロフィール、レシピ詳細 | 更新 Server Action で `del` 実行 |
| **パターン削除** | 一覧キャッシュ | `SCAN` + `DEL` で `aisent:recipes:list:*` を削除 |

### 6.6 Redis 接続設計

```typescript
// lib/redis.ts
import Redis from 'ioredis';

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn('REDIS_URL is not set. Caching is disabled.');
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 5000,
  });

  client.on('error', (err) => {
    console.error('[Redis Error]', err.message);
  });

  return client;
}

export const redis = createRedisClient();
```

### 6.7 キャッシュユーティリティ

```typescript
// lib/cache.ts
import { redis } from './redis';

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!redis) {
    return fetcher();
  }

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis障害時はフォールスルー
  }

  const data = await fetcher();

  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch {
    // 書き込み失敗は無視（次回リクエストで再取得）
  }

  return data;
}

export async function invalidate(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // 無効化失敗は無視（TTLで自然消滅）
  }
}
```

### 6.8 レートリミット

```typescript
// lib/rate-limit.ts
import { redis } from './redis';

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!redis) {
    return { allowed: true, remaining: maxRequests };
  }

  const key = `aisent:rate:${userId}:${endpoint}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
  };
}
```

### 6.9 レートリミット設定値

| エンドポイント | 上限 | ウィンドウ |
|---------------|------|----------|
| `POST /api/v1/blend/generate` | 10回 | 1分 |
| `POST /api/v1/auth/login` | 5回 | 1分 |
| `POST /api/v1/auth/register` | 3回 | 1分 |
| `POST /api/v1/orders` | 5回 | 1分 |
| 一般 API | 60回 | 1分 |

---

## 7. 環境変数管理

### 7.1 環境変数一覧

| 変数名 | 説明 | 必須 | デフォルト |
|--------|------|------|----------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | はい | - |
| `AUTH_SECRET` | Auth.js JWT 署名キー | はい | - |
| `AUTH_URL` | Auth.js ベース URL | はい | - |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | はい | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名シークレット | はい | - |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開キー | はい | - |
| `SENTRY_DSN` | Sentry DSN | いいえ | - |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (クライアント用) | いいえ | - |
| `REDIS_URL` | Redis 接続文字列 | いいえ | - |
| `RESEND_API_KEY` | Resend メール送信 API キー | いいえ | - |
| `OPENAI_API_KEY` | OpenAI API キー | いいえ | - |
| `AI_SERVICE_URL` | Python AI Service URL | いいえ | `http://localhost:8081` |
| `INTERNAL_SERVICE_TOKEN` | サービス間認証トークン | いいえ | - |

### 7.2 起動時バリデーション

Zod スキーマで環境変数を起動時に検証し、不足時は明確なエラーメッセージを出力する。

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  // Optional
  SENTRY_DSN: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

詳細実装は `apps/web/lib/env.ts` を参照。

### 7.3 .env.example

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kyarainnovate

# Auth.js
AUTH_SECRET=dev-auth-secret-change-in-production
AUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optional: Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Optional: Redis (Phase 1.5+)
REDIS_URL=

# Optional: Resend (Phase 3)
RESEND_API_KEY=

# Optional: OpenAI / AI Service
OPENAI_API_KEY=
AI_SERVICE_URL=http://localhost:8081
INTERNAL_SERVICE_TOKEN=dev-internal-token
```

---

## 8. 導入スケジュール

| Phase | 導入項目 | 備考 |
|-------|---------|------|
| Phase 1 | GitHub Actions CI, ヘルスチェック API, 環境変数バリデーション | 最小構成で即時導入 |
| Phase 1.5 | Sentry 統合, Redis キャッシュ, レートリミット | AI Service 追加と同時 |
| Phase 2 | 外部モニタリング（UptimeRobot）, アラートルール整備 | マーケットプレイス公開に合わせて |
| Phase 3 | 日次バックアップ自動化, PITR 設定, 月次バックアップ | 決済データ保護が必須 |

---

## 9. 運用チェックリスト

### 9.1 日次チェック

- [ ] Sentry ダッシュボードでエラー傾向を確認
- [ ] ヘルスチェック正常性を確認
- [ ] バックアップ実行ログを確認

### 9.2 週次チェック

- [ ] バックアップリストアテスト実行
- [ ] パフォーマンストレンド確認（P95レイテンシ）
- [ ] Redis メモリ使用量確認

### 9.3 月次チェック

- [ ] 月次フルバックアップの実行と保存確認
- [ ] RTO/RPO テスト実行
- [ ] セキュリティパッチ適用確認
- [ ] GitHub Secrets のローテーション確認

---

## 10. CI/CD本番デプロイジョブ（FM-006, RPN=280 / FM-046, RPN=280）

### 10.1 deploy-production ジョブ

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://kyarainnovate.com

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build

      - name: Deploy to Vercel (Production)
        run: |
          npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Run database migrations
        run: npx drizzle-kit push
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Smoke test
        run: |
          sleep 10
          curl -sf https://kyarainnovate.com/api/health/ready || exit 1
          echo "Smoke test passed"

      - name: Notify on success
        if: success()
        run: echo "Production deploy ${{ github.ref_name }} succeeded"

      - name: Notify on failure
        if: failure()
        run: echo "Production deploy ${{ github.ref_name }} FAILED"
```

### 10.2 承認ゲート

GitHub Environments の `production` 環境に以下を設定:

| 設定 | 値 | 目的 |
|------|-----|------|
| Required reviewers | 1名以上 | デプロイ前の人的承認 |
| Wait timer | 0分 | 承認後即時デプロイ |
| Deployment branches | `main` タグ `v*` のみ | 不正ブランチからのデプロイ防止 |

### 10.3 デプロイ後スモークテスト

| チェック項目 | エンドポイント | 期待値 |
|------------|-------------|--------|
| ヘルスチェック | `GET /api/health/ready` | 200 OK |
| DB接続 | ヘルスチェック内 | `db: connected` |
| 静的アセット | `GET /` | 200 OK |

---

## 11. 環境変数アクセスパターン（FM-047, RPN=210）

### 11.1 ルール

全モジュールで環境変数へのアクセスは `env.ts` 経由に統一する。

```typescript
// ✅ 正しいパターン
import { env } from '@/lib/env';
const dbUrl = env.DATABASE_URL;

// ❌ 禁止パターン
const dbUrl = process.env.DATABASE_URL;
```

### 11.2 ESLintルール（推奨）

```jsonc
// biome.json または eslint.config.js
{
  "linter": {
    "rules": {
      "custom": {
        "no-process-env": {
          "description": "Use env.ts instead of process.env",
          "pattern": "process\\.env\\.",
          "severity": "error",
          "allowedFiles": ["lib/env.ts", "next.config.ts", "sentry.*.config.ts"]
        }
      }
    }
  }
}
```

### 11.3 対象ファイルの修正一覧

| ファイル | 現状 | 修正内容 |
|---------|------|---------|
| `lib/stripe.ts` | `process.env.STRIPE_SECRET_KEY` | `env.STRIPE_SECRET_KEY` に変更 |
| `db/index.ts` | `process.env.DATABASE_URL` | `env.DATABASE_URL` に変更 |
| `app/api/health/ready/route.ts` | `process.env.DATABASE_URL` | `env.DATABASE_URL` に変更 |
| `lib/ai-client.ts` | `process.env.OPENAI_API_KEY` | `env.OPENAI_API_KEY` に変更 |
| `lib/redis.ts` | `process.env.REDIS_URL` | `env.REDIS_URL` に変更 |

---

## 12. デッドコード管理（FM-016, RPN=250）

### 12.1 デッドコード一覧と解消計画

| ファイル | 種類 | 原因 | 解消タイミング | 依存先 |
|---------|------|------|--------------|--------|
| `services/recipe-service.ts` | サービス関数 | APIルート未実装 | Phase 1 Sprint 2 | [recipe-system.md](./recipe-system.md) API実装後 |
| `services/review-service.ts` | サービス関数 | APIルート未実装 | Phase 1 Sprint 2 | [review-system.md](./review-system.md) API実装後 |
| `lib/audit-logger.ts` | ユーティリティ | middleware未統合 | Phase 1 Sprint 3 | [auth-user-management.md §11](./auth-user-management.md) |
| `lib/rate-limit.ts` | ユーティリティ | middleware未統合 | Phase 1 Sprint 3 | [auth-user-management.md §11](./auth-user-management.md) |
| `lib/security-headers.ts` | ユーティリティ | middleware未統合 | Phase 1 Sprint 2 | [auth-user-management.md §11](./auth-user-management.md) |

### 12.2 管理方針

- デッドコードは意図的に先行実装されたものであり、即時削除はしない
- 各コードに `// TODO: Connect in Sprint X` コメントを付与
- ロードマップ上の実装完了後にデッドコードが解消されることを確認する
- Sprint 終了時のレビューでデッドコード一覧を更新する

---

## 13. Linter設定（FM-045, RPN=72）

### 13.1 biome.json テンプレート

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn",
        "useFlatMap": "error"
      },
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn",
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsoleLog": "warn"
      },
      "style": {
        "useConst": "error",
        "useTemplate": "error"
      },
      "security": {
        "noDangerouslySetInnerHtml": "error"
      }
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      ".next",
      "dist",
      "coverage",
      "*.config.js",
      "*.config.ts"
    ]
  }
}
```

### 13.2 CI統合

```yaml
# .github/workflows/ci.yml の lint ジョブに追加
- name: Lint (Biome)
  run: npx biome check --error-on-warnings .
```

### 13.3 pre-commit フック

```jsonc
// package.json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["biome check --write"]
  }
}
```

---

## 14. NEXT_PUBLIC_BASE_URL 環境変数登録（FM-050, RPN=210）

### 14.1 課題

`NEXT_PUBLIC_BASE_URL` が `process.env` で直接参照されており、`env.ts` の一元管理から漏れている。環境ごとの値切り替えが明示されておらず、開発・本番で不整合が発生するリスクがある。

### 14.2 env.ts への追加

```typescript
// lib/env.ts に追加
export const env = createEnv({
  server: {
    // ... 既存の server 変数
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  },
  runtimeEnv: {
    // ... 既存のマッピング
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
});
```

### 14.3 環境別設定値

| 環境 | 値 | 設定場所 |
|------|-----|---------|
| development | `http://localhost:3000` | `.env.local`（デフォルト値で省略可） |
| preview | `https://${VERCEL_URL}` | Vercel自動設定 |
| staging | `https://staging.kyarainnovate.com` | Vercel Environment Variables |
| production | `https://kyarainnovate.com` | Vercel Environment Variables |

### 14.4 使用箇所の修正

```typescript
// 修正前（process.env 直接参照）
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

// 修正後（env.ts 経由）
import { env } from '@/lib/env';
const baseUrl = env.NEXT_PUBLIC_BASE_URL;
```

対象ファイル:
- `app/api/v1/checkout/route.ts` — Stripe success/cancel URL
- `lib/email/templates.ts` — メール内リンク生成
- `middleware.ts` — CORS オリジン設定

---

## 15. IP抽出ロジック共通化（FM-015, RPN=36）

### 15.1 課題

IP アドレス抽出ロジックが `rate-limiter.ts` と `audit-logger.ts` の2ファイルで重複実装されている。

### 15.2 現状の重複コード

```typescript
// rate-limiter.ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? request.headers.get('x-real-ip')
  ?? '127.0.0.1';

// audit-logger.ts（同一ロジック）
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? request.headers.get('x-real-ip')
  ?? '127.0.0.1';
```

### 15.3 共通ユーティリティ化

```typescript
// lib/utils/request.ts
import { headers } from 'next/headers';

/** リクエストからクライアントIPアドレスを抽出する */
export function extractClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1'
  );
}
```

### 15.4 適用方法

```typescript
// rate-limiter.ts
import { extractClientIp } from '@/lib/utils/request';

export function rateLimit(request: Request) {
  const ip = extractClientIp(request);
  // ... 既存ロジック
}

// audit-logger.ts
import { extractClientIp } from '@/lib/utils/request';

export function logAuditEvent(request: Request, event: AuditEvent) {
  const ip = extractClientIp(request);
  // ... 既存ロジック
}
```

---

## 16. 未使用インポート管理（FM-018, RPN=16）

### 16.1 課題

`order-service.ts` に未使用の `inArray` インポートが残存している。

```typescript
// order-service.ts — 現状
import { eq, desc, inArray } from 'drizzle-orm';  // inArray は未使用
```

### 16.2 修正方針

```typescript
// 修正後
import { eq, desc } from 'drizzle-orm';
```

### 16.3 再発防止

§13（Linter設定）の biome.json にて `noUnusedImports` ルールが有効になるため、CI パイプラインでの自動検出が可能。

```jsonc
// biome.json（§13で定義済み）
{
  "linter": {
    "rules": {
      "correctness": {
        "noUnusedImports": "error"  // 未使用インポートをエラーとして検出
      }
    }
  }
}
```

今後の開発では、biome のフォーマッター実行時に自動削除されるため、手動対応は不要となる。

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | FMEA対応: NEXT_PUBLIC_BASE_URL登録（§14）、IP抽出共通化（§15）、未使用インポート管理（§16）を追加 |
| 2026-02-17 | FMEA対応: CI/CD本番デプロイ（§10）、環境変数パターン（§11）、デッドコード管理（§12）、Linter設定（§13）を追加 |
| 2026-02-15 | 初版作成 |

---

*最終更新: 2026年2月17日*
