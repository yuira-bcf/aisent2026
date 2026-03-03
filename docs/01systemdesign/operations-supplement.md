# 運用設計補足書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 対象範囲 | バッチジョブ・DB接続・CDN・ログ・監視・デプロイ・負荷テスト・DR・マイグレーション |
| バージョン | 1.0 |
| 作成日 | 2026-02-17 |

---

## 1. バッチジョブスケジューリング

### 1.1 ジョブ一覧

| ジョブ名 | 実行頻度 | 実行時刻 (JST) | 説明 | 関連設計書 |
|---------|---------|---------------|------|-----------|
| `royalty-calculate` | Daily | 02:00 | ロイヤリティ計算・集計。完了済み注文からクリエーター別ロイヤリティを算出 | [royalty-system.md](./features/royalty-system.md) |
| `order-timeout-check` | Hourly | 毎時 00分 | 注文タイムアウト処理。PAID→SHIPPED 未遷移7日超の警告通知、SHIPPED→DELIVERED 未遷移30日超の自動遷移 | [cart-checkout-orders.md](./features/cart-checkout-orders.md) |
| `creator-tier-recalc` | Weekly | 月曜 03:00 | クリエーターティア再計算。全クリエーターのスコア再計算とティア昇降格判定 | [creator-system.md](./features/creator-system.md) |
| `monthly-report` | Monthly | 1日 04:00 | 月次レポート生成。売上・注文数・クリエーター統計・ロイヤリティ集計レポートを作成 | - |
| `expired-token-cleanup` | Daily | 03:00 | 期限切れトークン削除。Auth.js のセッション・検証トークンの失効レコードをパージ | - |
| `audit-log-archive` | Daily | 04:00 | 監査ログアーカイブ。90日超の操作ログを圧縮してアーカイブストレージに移動 | - |

### 1.2 ジョブランナー

**開発環境:** `node-cron` パッケージを使用し、Next.js プロセス内でスケジューリングを実行する。

```typescript
// apps/web/lib/cron/scheduler.ts
import cron from 'node-cron';

export function initCronJobs() {
  // ロイヤリティ計算（毎日 02:00 JST）
  cron.schedule('0 17 * * *', runRoyaltyCalculation, { timezone: 'Asia/Tokyo' });

  // 注文タイムアウト処理（毎時）
  cron.schedule('0 * * * *', runOrderTimeoutCheck, { timezone: 'Asia/Tokyo' });

  // クリエーターティア再計算（毎週月曜 03:00 JST）
  cron.schedule('0 18 * * 1', runCreatorTierRecalc, { timezone: 'Asia/Tokyo' });

  // 月次レポート生成（毎月1日 04:00 JST）
  cron.schedule('0 19 1 * *', runMonthlyReport, { timezone: 'Asia/Tokyo' });

  // 期限切れトークン削除（毎日 03:00 JST）
  cron.schedule('0 18 * * *', runExpiredTokenCleanup, { timezone: 'Asia/Tokyo' });

  // 監査ログアーカイブ（毎日 04:00 JST）
  cron.schedule('0 19 * * *', runAuditLogArchive, { timezone: 'Asia/Tokyo' });
}
```

**本番環境（Vercel）:** Vercel Cron Jobs を使用する。`vercel.json` に cron 設定を記述し、Route Handler をトリガーとする。

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/royalty-calculate",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/order-timeout-check",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/creator-tier-recalc",
      "schedule": "0 18 * * 1"
    },
    {
      "path": "/api/cron/monthly-report",
      "schedule": "0 19 1 * *"
    },
    {
      "path": "/api/cron/expired-token-cleanup",
      "schedule": "0 18 * * *"
    },
    {
      "path": "/api/cron/audit-log-archive",
      "schedule": "0 19 * * *"
    }
  ]
}
```

```typescript
// apps/web/app/api/cron/royalty-calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel Cron 認証チェック
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await runRoyaltyCalculation();
  return NextResponse.json({ ok: true });
}
```

### 1.3 同時実行制御

分散ロック（Redis SETNX）を使用し、複数インスタンスでの重複実行を防止する。

```typescript
// apps/web/lib/cron/distributed-lock.ts
import { redis } from '@/lib/redis';

export async function withDistributedLock<T>(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const lockValue = crypto.randomUUID();
  const acquired = await redis.set(lockKey, lockValue, {
    NX: true,    // キーが存在しない場合のみセット
    EX: ttlSeconds,  // TTL（秒）
  });

  if (!acquired) {
    console.warn(`[CRON] Lock already held: ${lockKey}`);
    return null;
  }

  try {
    return await fn();
  } finally {
    // ロック所有者のみ解放（CAS）
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
      await redis.del(lockKey);
    }
  }
}
```

| ジョブ | ロックキー | TTL |
|--------|-----------|-----|
| `royalty-calculate` | `cron:lock:royalty-calculate` | 3600s (1h) |
| `order-timeout-check` | `cron:lock:order-timeout` | 600s (10min) |
| `creator-tier-recalc` | `cron:lock:tier-recalc` | 3600s (1h) |
| `monthly-report` | `cron:lock:monthly-report` | 7200s (2h) |
| `expired-token-cleanup` | `cron:lock:token-cleanup` | 600s (10min) |
| `audit-log-archive` | `cron:lock:audit-archive` | 3600s (1h) |

### 1.4 失敗ハンドリング

全ジョブに共通のリトライロジックを適用する。

```typescript
// apps/web/lib/cron/retry.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    jobName: string;
  },
): Promise<T> {
  const { maxRetries, baseDelayMs, jobName } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 指数バックオフ

      logger.warn({
        jobName,
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
        nextRetryMs: isLastAttempt ? null : delayMs,
      }, `[CRON] Job attempt ${attempt}/${maxRetries} failed`);

      if (isLastAttempt) {
        // 最終失敗: アラート送信
        await sendAlert({
          level: 'P3',
          title: `バッチジョブ最終失敗: ${jobName}`,
          detail: `${maxRetries}回リトライ後も失敗。手動対応が必要です。`,
          error: error instanceof Error ? error.stack : String(error),
        });
        throw error;
      }

      await sleep(delayMs);
    }
  }

  throw new Error('Unreachable');
}
```

**リトライポリシー:**

| 回数 | 待機時間 | 説明 |
|------|---------|------|
| 1回目 | 即時実行 | 初回試行 |
| 2回目 | 5秒後 | `baseDelayMs=5000 * 2^0 = 5s` |
| 3回目 | 10秒後 | `baseDelayMs=5000 * 2^1 = 10s` |
| 最終失敗 | - | Slack + メールでアラート送信 |

### 1.5 ジョブ実行追跡テーブル

```typescript
// packages/db/src/schema/batch-job-runs.ts

export const batchJobRuns = pgTable(
  'batch_job_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobName: varchar('job_name', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('RUNNING'),
      // RUNNING | COMPLETED | FAILED | SKIPPED
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
      // 処理件数、対象期間等のジョブ固有情報
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_batch_job_runs_name').on(table.jobName),
    index('idx_batch_job_runs_status').on(table.status),
    index('idx_batch_job_runs_started').on(table.startedAt),
  ],
);
```

**ジョブラッパー:**

```typescript
// apps/web/lib/cron/job-runner.ts

export async function runJob(
  jobName: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<void> {
  const [run] = await db.insert(batchJobRuns).values({
    jobName,
    status: 'RUNNING',
  }).returning();

  try {
    const result = await withDistributedLock(
      `cron:lock:${jobName}`,
      3600,
      () => withRetry(fn, { maxRetries: 3, baseDelayMs: 5000, jobName }),
    );

    if (result === null) {
      // ロック取得失敗（他インスタンスが実行中）
      await db.update(batchJobRuns)
        .set({ status: 'SKIPPED', completedAt: new Date() })
        .where(eq(batchJobRuns.id, run.id));
      return;
    }

    await db.update(batchJobRuns)
      .set({ status: 'COMPLETED', completedAt: new Date(), metadata: result })
      .where(eq(batchJobRuns.id, run.id));
  } catch (error) {
    await db.update(batchJobRuns)
      .set({
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.stack : String(error),
      })
      .where(eq(batchJobRuns.id, run.id));
  }
}
```

---

## 2. データベース接続プール

### 2.1 接続プール構成

Drizzle ORM + `node-postgres` (`pg`) パッケージによる接続プーリングを使用する。

```typescript
// packages/db/src/client.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,                          // 最小接続数
  max: isProduction ? 10 : 5,      // 最大接続数（本番:10, プレビュー:5）
  connectionTimeoutMillis: 10_000,  // 接続タイムアウト: 10秒
  idleTimeoutMillis: 30_000,        // アイドルタイムアウト: 30秒
  statement_timeout: 30_000,        // ステートメントタイムアウト: 30秒（長時間クエリ防止）
});

export const db = drizzle(pool, { schema });
```

### 2.2 環境別設定

| 設定 | Development | Preview | Production |
|------|------------|---------|------------|
| `min` | 1 | 2 | 2 |
| `max` | 5 | 5 | 10 |
| `connectionTimeoutMillis` | 10,000 | 10,000 | 10,000 |
| `idleTimeoutMillis` | 30,000 | 30,000 | 30,000 |
| `statement_timeout` | 60,000 | 30,000 | 30,000 |
| `ssl` | false | true | true |

### 2.3 Serverless 環境（Vercel）での接続管理

Vercel のサーバーレス環境では、関数インスタンスごとにコネクションが生成されるため、pgBouncer を経由して接続数を制御する。

```
┌─────────────────────────────────────────────┐
│            Vercel Functions                  │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Func 1 │ │ Func 2 │ │ Func N │          │
│  │ Pool(2)│ │ Pool(2)│ │ Pool(2)│          │
│  └───┬────┘ └───┬────┘ └───┬────┘          │
└──────┼──────────┼──────────┼────────────────┘
       │          │          │
       ▼          ▼          ▼
┌──────────────────────────────────┐
│         pgBouncer                │
│  (transaction pooling mode)      │
│  max_client_conn: 200            │
│  default_pool_size: 20           │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│        PostgreSQL 16             │
│  max_connections: 100            │
└──────────────────────────────────┘
```

**接続文字列の切り分け:**

```env
# Direct接続（マイグレーション・バッチジョブ用）
DATABASE_URL="postgresql://user:pass@host:5432/kyarainnovate?sslmode=require"

# pgBouncer経由（アプリケーション用）
DATABASE_URL="postgresql://user:pass@host:6543/kyarainnovate?sslmode=require&pgbouncer=true"
```

### 2.4 モニタリング

**スロークエリ検出:**

```typescript
// packages/db/src/client.ts

pool.on('connect', (client) => {
  const originalQuery = client.query.bind(client);
  client.query = (...args: any[]) => {
    const start = Date.now();
    const result = originalQuery(...args);

    if (result instanceof Promise) {
      result.then(() => {
        const duration = Date.now() - start;
        if (duration > 1000) {
          logger.warn({
            query: typeof args[0] === 'string' ? args[0].substring(0, 200) : 'prepared',
            duration,
          }, '[DB] Slow query detected (>1s)');
        }
      });
    }

    return result;
  };
});
```

**接続プール枯渇アラート:**

```typescript
// 定期チェック（30秒間隔）
setInterval(() => {
  const { totalCount, idleCount, waitingCount } = pool;
  const usedCount = totalCount - idleCount;
  const utilizationPercent = (usedCount / pool.options.max!) * 100;

  if (utilizationPercent > 80) {
    logger.warn({
      totalCount,
      idleCount,
      waitingCount,
      utilizationPercent,
    }, '[DB] Connection pool utilization >80%');
  }

  if (waitingCount > 0) {
    logger.error({
      waitingCount,
    }, '[DB] Queries waiting for available connection');
  }
}, 30_000);
```

---

## 3. CDN・静的アセット最適化

### 3.1 Next.js Image Optimization

`next/image` コンポーネントを使用し、画像の自動最適化を行う。

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};
```

### 3.2 静的アセットのキャッシュ戦略

| アセット種別 | パス | Cache-Control | 説明 |
|-------------|------|--------------|------|
| ビルド済みJS/CSS | `/_next/static/**` | `public, max-age=31536000, immutable` | コンテンツハッシュ付きで変更時はURLが変わる |
| 画像最適化済み | `/_next/image/**` | `public, max-age=86400, stale-while-revalidate=604800` | 1日キャッシュ + 7日間 SWR |
| フォント | `/_next/static/media/**` | `public, max-age=31536000, immutable` | next/font で最適化済み |
| ユーザーアップロード | `/uploads/**` | `public, max-age=86400` | CDN経由で配信 |
| API レスポンス | `/api/**` | `no-store` | キャッシュしない |

### 3.3 ユーザーアップロード画像

**ストレージ構成:**

```
┌──────────────────┐      ┌────────────────────┐
│  Client          │      │  Vercel Blob        │
│  (next/image)    │─────▶│  or AWS S3          │
└──────────────────┘      │                     │
                          │  /{userId}/{type}/   │
                          │    {uuid}.{ext}      │
                          └─────────┬────────────┘
                                    │
                          ┌─────────▼────────────┐
                          │  CDN                   │
                          │  (Vercel Edge Network  │
                          │   or CloudFront)       │
                          └────────────────────────┘
```

| 設定 | 値 | 説明 |
|------|-----|------|
| ストレージ | Vercel Blob (推奨) / AWS S3 | サーバーレス環境との親和性 |
| CDN | Vercel Edge Network / CloudFront | 自動的にエッジキャッシュ |
| 最大ファイルサイズ | 5MB | アップロード時にサーバー側で検証 |
| 対応フォーマット | jpg, png, webp | `Content-Type` ヘッダーで検証 |
| 命名規則 | `{userId}/{type}/{uuid}.{ext}` | `type`: `avatar`, `recipe`, `product` |
| リサイズ | sharp ライブラリで処理 | アップロード時に複数サイズを生成 |

**画像処理パイプライン:**

```typescript
// apps/web/lib/image-upload.ts
import sharp from 'sharp';

const IMAGE_SIZES = {
  avatar: [
    { suffix: 'sm', width: 64, height: 64 },
    { suffix: 'md', width: 128, height: 128 },
    { suffix: 'lg', width: 256, height: 256 },
  ],
  recipe: [
    { suffix: 'thumb', width: 200, height: 200 },
    { suffix: 'card', width: 400, height: 300 },
    { suffix: 'full', width: 800, height: 600 },
  ],
} as const;

export async function processAndUploadImage(
  file: File,
  userId: string,
  type: 'avatar' | 'recipe',
): Promise<UploadResult> {
  // 1. バリデーション
  if (file.size > 5 * 1024 * 1024) throw new Error('ファイルサイズは5MB以下にしてください');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) throw new Error('jpg/png/webp形式のみ対応しています');

  // 2. 各サイズにリサイズ + WebP変換
  const buffer = Buffer.from(await file.arrayBuffer());
  const imageId = crypto.randomUUID();
  const results: string[] = [];

  for (const size of IMAGE_SIZES[type]) {
    const resized = await sharp(buffer)
      .resize(size.width, size.height, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const path = `${userId}/${type}/${imageId}-${size.suffix}.webp`;
    const url = await uploadToStorage(path, resized, 'image/webp');
    results.push(url);
  }

  return { imageId, urls: results };
}
```

### 3.4 フォント最適化

```typescript
// apps/web/app/layout.tsx
import { Noto_Sans_JP } from 'next/font/google';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
});
```

| 最適化 | 詳細 |
|--------|------|
| `next/font` | Google Fonts をビルド時にセルフホスティング。外部リクエスト不要 |
| `display: swap` | フォント読み込み中にフォールバックフォントを表示し、CLS を防止 |
| `preload: true` | 重要フォントを `<link rel="preload">` で先行読み込み |
| サブセット | `latin` サブセットを指定し、不要なグリフを除外 |

### 3.5 バンドル分析

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^15.0.0"
  }
}
```

```typescript
// next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer';

const config = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({
  // ... other config
});
```

**バンドルサイズ目標:**

| チャンク | 目標サイズ (gzip) | 備考 |
|---------|-----------------|------|
| First Load JS | < 100kB | 初回表示に必要なJS |
| ページ固有JS | < 50kB | 各ページの追加JS |
| Recharts | < 80kB | チャートライブラリ（動的インポート） |
| Stripe.js | 外部CDN | `@stripe/stripe-js` は Stripe CDN から読込み |

---

## 4. 構造化ログ

### 4.1 ロガー構成

`pino` を使用した JSON 構造化ログを採用する。

```typescript
// apps/web/lib/logger.ts
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

  // 本番: JSON、開発: pino-pretty
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },

  // 標準フィールド
  base: {
    service: 'kyarainnovate-web',
    env: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  },

  // 機密データマスキング
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'creditCard',
      'req.headers.authorization',
      'req.headers.cookie',
      'stripe.*.client_secret',
    ],
    censor: '[REDACTED]',
  },

  // タイムスタンプ
  timestamp: pino.stdTimeFunctions.isoTime,

  // シリアライザー
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});
```

### 4.2 ログレベル

| レベル | 数値 | 用途 | 出力先 |
|--------|------|------|--------|
| `fatal` | 60 | プロセス停止を伴う致命的エラー | Production + Alert |
| `error` | 50 | 処理失敗（ユーザー影響あり） | Production + Alert |
| `warn` | 40 | 非正常だが処理継続可能 | Production |
| `info` | 30 | 正常な業務イベント（注文確定、決済完了等） | Production |
| `debug` | 20 | 開発時のデバッグ情報 | Development |
| `trace` | 10 | 詳細なトレース情報 | Development（明示的有効化時のみ） |

### 4.3 標準ログフィールド

全リクエストで以下のフィールドを出力する。

```typescript
type LogContext = {
  // 自動付与
  timestamp: string;       // ISO 8601 形式
  level: string;           // ログレベル
  service: string;         // "kyarainnovate-web"
  env: string;             // "production" | "preview" | "development"
  version: string;         // アプリケーションバージョン

  // リクエストコンテキスト（リクエスト単位で付与）
  requestId: string;       // crypto.randomUUID() で生成
  userId?: string;         // 認証済みユーザーID
  path: string;            // リクエストパス
  method: string;          // HTTP メソッド
  statusCode: number;      // レスポンスステータスコード
  duration: number;        // リクエスト処理時間 (ms)
  userAgent?: string;      // User-Agent ヘッダー

  // メッセージ
  msg: string;             // ログメッセージ
};
```

### 4.4 リクエストID

リクエスト単位で一意のIDを生成し、全ログに付与する。外部サービス呼び出し時にもヘッダーで伝播する。

```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const response = NextResponse.next();

  // レスポンスヘッダーにも設定
  response.headers.set('x-request-id', requestId);

  return response;
}
```

```typescript
// リクエストコンテキスト（AsyncLocalStorage）
// apps/web/lib/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  requestId: string;
  userId?: string;
  startTime: number;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string {
  return requestContext.getStore()?.requestId ?? 'no-context';
}
```

### 4.5 ログ出力先

```
┌──────────────────────┐
│   Application        │
│   (pino → JSON)      │
└─────────┬────────────┘
          │ stdout
          ▼
┌──────────────────────┐      ┌──────────────────────┐
│   Development        │      │   Production         │
│   pino-pretty        │      │   JSON → stdout      │
│   → terminal         │      │   → Vercel Log Drain │
└──────────────────────┘      └─────────┬────────────┘
                                        │
                              ┌─────────▼────────────┐
                              │   Datadog / Loki      │
                              │   (ログ集約・検索)      │
                              └────────────────────────┘
```

| 環境 | 出力先 | フォーマット |
|------|--------|-------------|
| Development | stdout (terminal) | pino-pretty（人間可読） |
| Preview | Vercel Log Drain | JSON |
| Production | Vercel Log Drain → Datadog / Grafana Loki | JSON |

### 4.6 パフォーマンスログ

```typescript
// apps/web/lib/logger.ts

export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>,
) {
  const logData = { operation, durationMs, ...metadata };

  if (durationMs > 3000) {
    logger.error(logData, `[PERF] Slow operation: ${operation}`);
  } else if (durationMs > 1000) {
    logger.warn(logData, `[PERF] Degraded operation: ${operation}`);
  } else {
    logger.info(logData, `[PERF] ${operation}`);
  }
}

// 使用例
const start = Date.now();
const result = await db.query.orders.findMany({ ... });
logPerformance('db.orders.findMany', Date.now() - start, {
  resultCount: result.length,
  filters: { status: 'PAID', userId },
});
```

**計測対象:**

| 対象 | 閾値 (warn) | 閾値 (error) | 説明 |
|------|-----------|------------|------|
| リクエスト処理時間 | > 1,000ms | > 3,000ms | API/ページ全体の処理時間 |
| DBクエリ時間 | > 500ms | > 1,000ms | 個別クエリの実行時間 |
| 外部API呼出し | > 2,000ms | > 5,000ms | Stripe, AI API 等 |
| 画像処理時間 | > 3,000ms | > 10,000ms | sharp によるリサイズ処理 |

---

## 5. アラート・モニタリング

### 5.1 アラートチャネル

| チャネル | 用途 | 設定 |
|---------|------|------|
| Slack Webhook | P1〜P3 アラート通知 | `SLACK_ALERT_WEBHOOK_URL` 環境変数 |
| Email (Resend) | P1 アラートのエスカレーション | 運用チーム配信リスト |
| PagerDuty | P1 オンコール対応 | 24/365 対応が必要な重大障害 |

```typescript
// apps/web/lib/alert.ts

type AlertLevel = 'P1' | 'P2' | 'P3' | 'P4';

type AlertPayload = {
  level: AlertLevel;
  title: string;
  detail: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const { level, title, detail } = payload;

  // Slack 通知（P1〜P3）
  if (['P1', 'P2', 'P3'].includes(level)) {
    await sendSlackAlert(payload);
  }

  // PagerDuty（P1 のみ）
  if (level === 'P1') {
    await triggerPagerDuty(payload);
  }

  // メール（P1 のみ）
  if (level === 'P1') {
    await sendAlertEmail(payload);
  }

  // 全アラートをログに記録
  logger.error({ alertLevel: level, title, detail }, `[ALERT:${level}] ${title}`);
}
```

### 5.2 アラートレベル定義

| レベル | 名称 | 応答目標 | トリガー例 | 通知先 |
|--------|------|---------|-----------|--------|
| P1 | Critical | 5分以内 | 500エラー率 > 5%, 決済失敗スパイク, DB接続不能, 全サービス停止 | Slack + PagerDuty + Email |
| P2 | High | 30分以内 | API レイテンシ p95 > 3s, キュー滞留 > 100件, ディスク使用率 > 80% | Slack |
| P3 | Medium | 4時間以内 | 新規エラータイプ検出, サービス劣化, バッチジョブ失敗 | Slack |
| P4 | Low | 翌営業日 | 警告トレンド増加, キャパシティプランニング, 非重要バッチ遅延 | Slack (低優先チャネル) |

### 5.3 アラート条件

**P1 (Critical):**

| 条件 | 閾値 | 計測方法 |
|------|------|---------|
| 500 エラー率 | > 5% (5分間ウィンドウ) | レスポンスステータスコードの集計 |
| 決済失敗スパイク | > 10件/5分 | Stripe Webhook `payment_intent.payment_failed` カウント |
| DB 接続不能 | 接続プール枯渇 + 接続タイムアウト | `pool.waitingCount > 0` かつ `totalCount === max` |
| ヘルスチェック失敗 | 3回連続失敗 | `/api/health` エンドポイント監視 |

**P2 (High):**

| 条件 | 閾値 | 計測方法 |
|------|------|---------|
| API レイテンシ | p95 > 3,000ms (5分間) | リクエスト処理時間の統計 |
| DB クエリレイテンシ | p95 > 1,000ms | クエリ実行時間の統計 |
| メモリ使用率 | > 85% | `process.memoryUsage()` |
| ディスク使用率 | > 80% | OS メトリクス |

**P3 (Medium):**

| 条件 | 閾値 | 計測方法 |
|------|------|---------|
| バッチジョブ失敗 | 最終リトライ失敗 | `batch_job_runs.status = 'FAILED'` |
| 新規エラータイプ | 過去24時間に未検出のエラーメッセージ | エラーログのパターンマッチング |
| 外部API レイテンシ | Stripe/AI API p95 > 5,000ms | 外部呼出し時間の統計 |

### 5.4 ダッシュボード

**ツール:** Grafana (セルフホスト) または Vercel Analytics (マネージド)

**システムダッシュボード:**

```
┌──────────────────────────────────────────────────────┐
│  System Dashboard                                     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ CPU Usage   │ │ Memory      │ │ Disk I/O    │    │
│  │ ▂▃▅▃▂▃▄▃▂  │ │ 62% / 4GB  │ │ R:12 W:8    │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ Request Rate│ │ Error Rate  │ │ Active Conn │    │
│  │ 125 req/s   │ │ 0.02%      │ │ 8/10 pool   │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                       │
│  Request Latency (p50 / p95 / p99)                   │
│  ▁▂▃▂▁▂▃▂▁▂▃▄▃▂▁▂▃▂▁                               │
│  45ms / 180ms / 450ms                                 │
└──────────────────────────────────────────────────────┘
```

**ビジネスダッシュボード:**

| メトリクス | 説明 | 更新頻度 |
|-----------|------|---------|
| 注文数/日 | 日別注文件数の推移 | リアルタイム |
| 調合リクエスト数/日 | 日別調合リクエスト件数（モード別） | リアルタイム |
| アクティブクリエーター数 | 過去30日間に活動のあるクリエーター数 | 日次 |
| 売上高 | 日別・週別・月別の売上推移 | リアルタイム |
| GMV (総取扱高) | プラットフォーム全体の取扱金額 | 日次 |
| コンバージョン率 | 調合 → カート追加 → 決済完了の各ステップ | 日次 |

**パフォーマンスダッシュボード:**

| メトリクス | 説明 | アラート閾値 |
|-----------|------|------------|
| p50 / p95 / p99 レイテンシ | エンドポイント別の応答時間分布 | p95 > 500ms (read), > 2s (blend) |
| DB クエリ時間 | クエリ別の実行時間分布 | p95 > 500ms |
| キャッシュヒット率 | ISR/データキャッシュのヒット率 | < 80% |
| Stripe API レイテンシ | 決済API の応答時間 | p95 > 3s |
| AI API レイテンシ | ストーリー生成の応答時間 | p95 > 5s |
| エラーバジェット残量 | SLO に対するエラー残量 | < 20% で警告 |

---

## 6. デプロイメント戦略

### 6.1 デプロイ方式

Vercel の Blue-Green デプロイメントを採用する。新バージョンは別のデプロイメントURLで事前確認可能で、切り替えは瞬時かつアトミックに行われる。

```
┌──────────────────────────────────────────┐
│             Vercel Platform               │
│                                           │
│  main branch push                         │
│       │                                   │
│       ▼                                   │
│  ┌──────────┐     ┌──────────┐           │
│  │ Build    │────▶│ Preview  │ ← 事前確認 │
│  │ & Deploy │     │ URL      │            │
│  └──────────┘     └────┬─────┘           │
│                        │ promote          │
│                        ▼                  │
│  ┌──────────────────────────┐            │
│  │  Production              │            │
│  │  kyarainnovate.com       │            │
│  │  (Blue-Green swap)       │            │
│  └──────────────────────────┘            │
└──────────────────────────────────────────┘
```

### 6.2 フィーチャーフラグ

環境変数ベースのフィーチャーフラグで段階的ロールアウトを実現する。

```typescript
// apps/web/lib/feature-flags.ts

export const featureFlags = {
  // 新機能のトグル
  ENABLE_PAYPAY_PAYMENT: process.env.FF_ENABLE_PAYPAY === 'true',
  ENABLE_KONBINI_PAYMENT: process.env.FF_ENABLE_KONBINI === 'true',
  ENABLE_RECIPE_AI_ASSIST: process.env.FF_ENABLE_RECIPE_AI === 'true',
  ENABLE_FRAGRANCE_MAP: process.env.FF_ENABLE_FRAGRANCE_MAP === 'true',

  // A/Bテスト
  CHECKOUT_V2: process.env.FF_CHECKOUT_V2 === 'true',
} as const;

// 使用例
if (featureFlags.ENABLE_PAYPAY_PAYMENT) {
  paymentMethods.push('paypay');
}
```

### 6.3 データベースマイグレーション

Drizzle Kit を使用したマイグレーション管理。

```bash
# マイグレーション生成（スキーマ変更後）
npx drizzle-kit generate

# マイグレーション適用
npx drizzle-kit migrate

# スキーマの差分確認
npx drizzle-kit check
```

**マイグレーション戦略:**

| 原則 | 説明 |
|------|------|
| Forward-only | マイグレーションは前方のみ。手動ロールバックスクリプトを別途用意 |
| 後方互換性 | 新旧コードが同時に動作できるスキーマ変更のみ許可 |
| Pre-deploy | コードデプロイ前にマイグレーションを実行 |
| 小さなステップ | 大きな変更は複数のマイグレーションに分割 |

**実行順序:**

```
1. マイグレーション実行（スキーマ変更）
2. コードデプロイ（新バージョン）
3. 旧カラムのクリーンアップ（次回デプロイ）
```

**ロールバック手順:**

| 状況 | 対応 |
|------|------|
| コードのみの問題 | Vercel で前バージョンにロールバック（即時） |
| マイグレーション後の問題 | 手動で逆マイグレーションスクリプト実行 → コードロールバック |
| データ破損 | DBバックアップからリストア（§8 DR 手順に従う） |

### 6.4 リリースプロセス

```
Step 1: Feature branch 作成
  └─ git checkout -b feature/xxx

Step 2: Pull Request 作成
  └─ コードレビュー
  └─ CI 自動実行（lint, test, build, type-check）
  └─ Preview デプロイ（Vercel Preview URL で動作確認）

Step 3: main ブランチへマージ
  └─ Squash merge

Step 4: Staging 自動デプロイ
  └─ staging 環境で E2E テスト実行
  └─ ステークホルダー確認

Step 5: Production デプロイ
  └─ 手動承認（GitHub Environment Protection Rules）
  └─ マイグレーション実行（必要な場合）
  └─ Vercel Production デプロイ

Step 6: Post-deploy 検証
  └─ ヘルスチェック API 確認
  └─ Smoke テスト（主要フロー手動確認）
  └─ エラーレート監視（30分間）
  └─ 異常検知時: 即時ロールバック
```

**CI パイプライン:**

```yaml
# .github/workflows/ci.yml (概要)
jobs:
  lint:
    - biome check
  type-check:
    - tsc --noEmit
  test:
    - vitest run
  build:
    - next build
  e2e:
    - playwright test (staging のみ)
```

---

## 7. 負荷テスト計画

### 7.1 テストツール

**k6 (Grafana k6)** を採用する。JavaScript/TypeScript でシナリオを記述でき、Grafana との統合でリアルタイムにメトリクスを可視化できる。

### 7.2 テストシナリオ

| シナリオ | VU数 | 期間 | 目的 |
|---------|------|------|------|
| Smoke Test | 1 VU | 1分 | 基本機能の正常動作確認 |
| Load Test | 50 VU | 10分 | 通常負荷での性能確認 |
| Stress Test | 200 VU | 5分 | ピーク負荷での性能限界確認 |
| Spike Test | 0→500 VU (10秒) | 3分 | 急激なトラフィック増加への耐性確認 |

```javascript
// load-tests/scenarios/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      startTime: '1m',
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '1m', target: 0 },
      ],
      startTime: '12m',
      tags: { scenario: 'stress' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '10s', target: 0 },
      ],
      startTime: '20m',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],          // p95 < 500ms
    http_req_failed: ['rate<0.001'],           // エラー率 < 0.1%
    'http_req_duration{endpoint:blend}': ['p(95)<2000'],   // blend p95 < 2s
    'http_req_duration{endpoint:checkout}': ['p(95)<3000'], // checkout p95 < 3s
  },
};
```

### 7.3 テスト対象エンドポイント

| エンドポイント | メソッド | 特性 | 負荷パターン | 備考 |
|--------------|---------|------|------------|------|
| `POST /api/v1/blends` | POST | CPU集約（AI配合計算） | Write-heavy | Decimal.js 計算 + AI API 呼出し |
| `GET /api/v1/recipes` | GET | DB読取（一覧取得） | Read-heavy | ページネーション・フィルタリング |
| `POST /api/v1/orders` | POST | Stripe + DB書込み | Write-heavy | トランザクション + 外部API |
| `GET /api/v1/creators` | GET | キャッシュ可能 | Read-heavy | ISR キャッシュヒット率を計測 |
| `GET /api/v1/creators/[id]` | GET | キャッシュ可能 | Read-heavy | ISR 60秒キャッシュ |
| `POST /api/v1/cart/items` | POST | DB書込み | Write-heavy | 在庫チェック含む |

### 7.4 テストデータ

```typescript
// load-tests/data/test-users.ts

// 事前に staging 環境に以下を用意
// - テストユーザー 100名（CUSTOMER ロール）
// - テストクリエーター 10名（CREATOR ロール）
// - テストレシピ 50件（PUBLISHED ステータス）
// - テスト商品 20件（在庫あり）
```

### 7.5 SLO (Service Level Objectives)

| 指標 | 目標 | 計測方法 | 計測期間 |
|------|------|---------|---------|
| 可用性 | 99.9% | `(1 - エラーリクエスト数/全リクエスト数) * 100` | 月次 |
| レイテンシ (Read) | p95 < 500ms | レシピ一覧、クリエーター一覧等の GET リクエスト | ローリング5分 |
| レイテンシ (Blend) | p95 < 2,000ms | 調合リクエスト（AI計算含む） | ローリング5分 |
| レイテンシ (Checkout) | p95 < 3,000ms | チェックアウト処理（Stripe通信含む） | ローリング5分 |
| エラー率 | < 0.1% | 5xx レスポンス / 全レスポンス | ローリング5分 |

**エラーバジェット:**

```
月間許容ダウンタイム (99.9%):
  30日 × 24時間 × 60分 × 0.001 = 43.2分/月

月間許容エラー数 (0.1%):
  想定月間リクエスト数 100,000 × 0.001 = 100エラー/月
```

### 7.6 エンドポイント別パフォーマンスSLO

各エンドポイントの特性に基づき、4つのSLOティアに分類する。

**SLOティア定義:**

| ティア | p50 目標 | p95 目標 | p99 目標 | 対象 |
|--------|---------|---------|---------|------|
| **Tier A** (即時応答) | < 50ms | < 200ms | < 500ms | キャッシュ可能なGET、静的データ |
| **Tier B** (標準応答) | < 100ms | < 500ms | < 1,000ms | DB読取、一覧取得、CRUD操作 |
| **Tier C** (重処理) | < 500ms | < 2,000ms | < 5,000ms | AI計算、外部API通信を伴う処理 |
| **Tier D** (バッチ的) | < 1,000ms | < 3,000ms | < 10,000ms | PDF生成、Stripe通信、大量データ処理 |

**エンドポイント別SLOマトリクス:**

#### ヘルス & 認証

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/health` | GET | A | 200ms | DB接続チェックなし |
| `/api/health/ready` | GET | B | 500ms | DB・Redis・Stripe 接続確認 |
| `/api/v1/auth/register` | POST | B | 500ms | パスワードハッシュ (bcrypt) |
| `/api/v1/auth/login` | POST | B | 500ms | bcrypt 照合 |
| `/api/v1/auth/me` | GET | A | 200ms | セッション取得のみ |
| `/api/v1/auth/me` | PATCH | B | 500ms | プロフィール更新 |
| `/api/v1/auth/password-reset/request` | POST | C | 2,000ms | メール送信 (Resend API) |
| `/api/v1/auth/password-reset/confirm` | POST | B | 500ms | トークン検証 + 更新 |
| `/api/v1/auth/password` | PUT | B | 500ms | bcrypt ハッシュ |
| `/api/v1/auth/taste-preferences` | POST | B | 500ms | DB書込み |

#### 調合 (Blend)

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/blend/flavors` | GET | A | 200ms | マスタデータ (ISRキャッシュ推奨) |
| `/api/v1/blend/keywords` | GET | A | 200ms | マスタデータ (ISRキャッシュ推奨) |
| `/api/v1/blend/calculate` | POST | B | 500ms | Decimal.js 計算のみ (AI不要) |
| `/api/v1/blend/generate` | POST | C | 2,000ms | AI API + DB書込み + ストーリー生成 |
| `/api/v1/blend/results` | GET | B | 500ms | ページネーション付き一覧 |
| `/api/v1/blend/results/[id]` | GET | B | 500ms | 詳細取得 (with relations) |
| `/api/v1/blend/results/[id]` | PATCH | B | 500ms | 名前更新等 |

#### ショップ & カート

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/shop/products` | GET | A | 200ms | 商品一覧 (ISRキャッシュ推奨) |
| `/api/v1/shop/products/[id]` | GET | A | 200ms | 商品詳細 |
| `/api/v1/shop/products/[id]/favorite` | POST | B | 500ms | お気に入りトグル |
| `/api/v1/shop/favorites` | GET | B | 500ms | お気に入り一覧 |
| `/api/v1/cart` | GET | B | 500ms | カート取得 |
| `/api/v1/cart/items` | POST | B | 500ms | カート追加 (在庫チェック) |
| `/api/v1/cart/items/[id]` | PATCH | B | 500ms | 数量変更 |
| `/api/v1/cart/items/[id]` | DELETE | B | 500ms | カートから削除 |

#### 注文 & 決済

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/orders` | GET | B | 500ms | 注文一覧 |
| `/api/v1/orders` | POST | D | 3,000ms | 注文作成 (Stripe PaymentIntent) |
| `/api/v1/orders/[id]` | GET | B | 500ms | 注文詳細 |
| `/api/v1/orders/[id]/cancel` | POST | C | 2,000ms | キャンセル (Stripe Refund) |
| `/api/v1/orders/[id]/status` | PATCH | B | 500ms | ステータス更新 (Admin) |
| `/api/v1/orders/webhook` | POST | B | 500ms | Stripe Webhook (署名検証のみ) |
| `/api/v1/receipt/[orderId]` | GET | D | 3,000ms | PDF生成 (@react-pdf/renderer) |

#### 配送 & クーポン

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/shipping-addresses` | GET | B | 500ms | 配送先一覧 |
| `/api/v1/shipping-addresses` | POST | B | 500ms | 配送先追加 |
| `/api/v1/shipping-addresses/[id]` | PATCH | B | 500ms | 配送先更新 |
| `/api/v1/shipping-addresses/[id]` | DELETE | B | 500ms | 配送先削除 |
| `/api/v1/coupons/validate` | POST | B | 500ms | クーポン検証 |

#### レビュー & パーソナライゼーション

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/reviews` | POST | B | 500ms | レビュー投稿 |
| `/api/v1/personalization/recommendations` | GET | C | 2,000ms | 推薦ロジック (複数テーブルJOIN) |

#### 通知

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/notifications` | GET | B | 500ms | 通知一覧 |
| `/api/v1/notifications/unread-count` | GET | A | 200ms | カウントクエリのみ |
| `/api/v1/notifications/[id]/read` | PATCH | A | 200ms | 単一更新 |
| `/api/v1/notifications/read-all` | PATCH | B | 500ms | 一括更新 |
| `/api/v1/notifications/[id]` | PUT | A | 200ms | 既読マーク |
| `/api/v1/notifications/[id]` | DELETE | A | 200ms | 削除 |
| `/api/v1/notifications/preferences` | GET | A | 200ms | 設定取得 |
| `/api/v1/notifications/preferences` | PUT | B | 500ms | 設定更新 |

#### クリエーター (Creator)

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/creator/profile` | GET | B | 500ms | プロフィール取得 |
| `/api/v1/creator/profile` | PUT | B | 500ms | プロフィール更新 |
| `/api/v1/creator/style` | GET | B | 500ms | スタイル取得 |
| `/api/v1/creator/style` | PUT | B | 500ms | スタイル更新 |
| `/api/v1/creator/favorites` | GET | B | 500ms | お気に入り一覧 |
| `/api/v1/creator/favorites` | POST | B | 500ms | お気に入りトグル |
| `/api/v1/creator/application` | GET | B | 500ms | 申請状況取得 |
| `/api/v1/creator/application` | POST | B | 500ms | 申請提出 |
| `/api/v1/creator/keywords` | GET | B | 500ms | キーワード一覧 |
| `/api/v1/creator/keywords/[id]/rules` | GET | B | 500ms | ルール取得 |
| `/api/v1/creator/keywords/[id]/rules` | PUT | B | 500ms | ルール更新 |
| `/api/v1/creator/keywords/[id]/suggest` | POST | C | 2,000ms | AI提案 (外部API) |
| `/api/v1/creator/recipes` | GET | B | 500ms | レシピ一覧 |
| `/api/v1/creator/recipes` | POST | B | 500ms | レシピ作成 |
| `/api/v1/creator/recipes/[id]` | GET | B | 500ms | レシピ詳細 |
| `/api/v1/creator/recipes/[id]` | PUT | B | 500ms | レシピ更新 |
| `/api/v1/creator/recipes/[id]` | DELETE | B | 500ms | レシピアーカイブ |
| `/api/v1/creator/recipes/[id]/publish` | POST | B | 500ms | レシピ公開 |
| `/api/v1/creator/stats` | GET | B | 500ms | 統計取得 |
| `/api/v1/creator/royalties` | GET | B | 500ms | ロイヤリティ取得 |
| `/api/v1/creator/data-input/flavor-notes` | GET | B | 500ms | フレーバーノート取得 |
| `/api/v1/creator/data-input/flavor-notes` | POST | B | 500ms | フレーバーノート保存 |
| `/api/v1/creator/data-input/prohibited` | GET | B | 500ms | 禁止組合わせ取得 |
| `/api/v1/creator/data-input/prohibited` | POST | B | 500ms | 禁止組合わせ追加 |
| `/api/v1/creator/data-input/prohibited` | DELETE | B | 500ms | 禁止組合わせ削除 |
| `/api/v1/creator/data-input/compatibility` | GET | B | 500ms | 相性評価取得 |
| `/api/v1/creator/data-input/compatibility` | POST | B | 500ms | 相性評価保存 |
| `/api/v1/creator/footprints` | GET | B | 500ms | 足跡取得 |

#### クリエーター公開 (Public)

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/creators` | GET | A | 200ms | クリエーター一覧 (ISR 60秒) |
| `/api/v1/creators/[slug]` | GET | A | 200ms | クリエーター詳細 (ISR 60秒) |
| `/api/v1/creators/[slug]/visit` | POST | A | 200ms | 足跡記録 (非同期書込み推奨) |

#### 管理者 (Admin)

| エンドポイント | メソッド | SLOティア | p95 目標 | 備考 |
|--------------|---------|----------|---------|------|
| `/api/v1/admin/dashboard` | GET | C | 2,000ms | 集計クエリ (複数COUNT) |
| `/api/v1/admin/users` | GET | B | 500ms | ユーザー一覧 |
| `/api/v1/admin/users/[id]/role` | PATCH | B | 500ms | ロール変更 |
| `/api/v1/admin/orders` | GET | B | 500ms | 注文一覧 |
| `/api/v1/admin/orders/[id]/status` | PATCH | B | 500ms | ステータス更新 |
| `/api/v1/admin/products` | GET | B | 500ms | 商品一覧 |
| `/api/v1/admin/products` | POST | B | 500ms | 商品作成 |
| `/api/v1/admin/products/[id]` | PUT | B | 500ms | 商品更新 |
| `/api/v1/admin/products/[id]` | DELETE | B | 500ms | 商品削除 |
| `/api/v1/admin/flavors` | GET | A | 200ms | 香料一覧 |
| `/api/v1/admin/flavors` | POST | B | 500ms | 香料作成 |
| `/api/v1/admin/flavors/[id]` | GET | A | 200ms | 香料詳細 |
| `/api/v1/admin/flavors/[id]` | PUT | B | 500ms | 香料更新 |
| `/api/v1/admin/flavors/[id]` | DELETE | B | 500ms | 香料削除 |
| `/api/v1/admin/creators` | GET | B | 500ms | クリエーター申請一覧 |
| `/api/v1/admin/creators/[id]/review` | POST | B | 500ms | 申請審査 |
| `/api/v1/admin/reviews` | GET | B | 500ms | レビュー一覧 |
| `/api/v1/admin/reviews/[id]` | PATCH | B | 500ms | レビュー表示切替 |
| `/api/v1/admin/ai-rules` | GET | B | 500ms | AIルール一覧 |
| `/api/v1/admin/ai-rules` | POST | B | 500ms | AIルール作成 |
| `/api/v1/admin/ai-rules/[id]` | PUT | B | 500ms | AIルール更新 |
| `/api/v1/admin/ai-rules/[id]` | DELETE | B | 500ms | AIルール削除 |
| `/api/v1/admin/rule-matrix` | GET | B | 500ms | ルールマトリクス取得 |
| `/api/v1/admin/rule-matrix` | PUT | B | 500ms | ルールマトリクス更新 |
| `/api/v1/admin/coupons` | GET | B | 500ms | クーポン一覧 |
| `/api/v1/admin/coupons` | POST | B | 500ms | クーポン作成 |
| `/api/v1/admin/coupons/[id]` | PUT | B | 500ms | クーポン更新 |
| `/api/v1/admin/coupons/[id]` | DELETE | B | 500ms | クーポン無効化 |
| `/api/v1/admin/ec-settings` | GET | A | 200ms | EC設定取得 |
| `/api/v1/admin/ec-settings` | PUT | B | 500ms | EC設定更新 |
| `/api/v1/admin/calibration` | GET | A | 200ms | キャリブレーション取得 |
| `/api/v1/admin/calibration` | PUT | B | 500ms | キャリブレーション更新 |

#### SLOティア分布サマリ

| ティア | エンドポイント数 | 割合 |
|--------|---------------|------|
| Tier A (即時応答) | 22 | 26% |
| Tier B (標準応答) | 53 | 63% |
| Tier C (重処理) | 6 | 7% |
| Tier D (バッチ的) | 3 | 4% |
| **合計** | **84** | **100%** |

#### SLO違反時のアクション

| ティア | 違反条件 | アラートレベル | 対応 |
|--------|---------|-------------|------|
| Tier A | p95 > 200ms (5分間) | P3 | キャッシュ設定確認、インデックス追加検討 |
| Tier B | p95 > 500ms (5分間) | P3 | クエリ最適化、N+1検出 |
| Tier C | p95 > 2,000ms (5分間) | P2 | 外部API タイムアウト調整、非同期化検討 |
| Tier D | p95 > 3,000ms (5分間) | P2 | PDF生成の非同期化、Stripeタイムアウト調整 |
| 全ティア | p99 > 10,000ms | P1 | 即時対応、エスカレーション |

### 7.7 テスト実行スケジュール

| タイミング | テスト種別 | 環境 |
|-----------|-----------|------|
| PR マージ前 | Smoke Test | Preview |
| Staging デプロイ後 | Load Test | Staging |
| リリース前（月次） | Stress Test + Spike Test | Staging |
| 四半期 | 全シナリオ + キャパシティプランニング | Staging |

---

## 8. 災害復旧 (DR)

### 8.1 復旧目標

| 指標 | 目標 | 説明 |
|------|------|------|
| RPO (Recovery Point Objective) | 1時間 | 最大1時間分のデータ損失を許容 |
| RTO (Recovery Time Objective) | 4時間 | 障害発生から4時間以内にサービス復旧 |

### 8.2 バックアップ構成

```
┌────────────────────────────────────────────┐
│  Primary Region (ap-northeast-1)            │
│                                             │
│  ┌──────────────────┐                       │
│  │ PostgreSQL 16    │                       │
│  │ (Primary)        │──── WAL ストリーム ──┐ │
│  │                  │                      │ │
│  │ 自動バックアップ  │                      │ │
│  │ (1時間ごと)       │                      │ │
│  └──────────────────┘                      │ │
│                                             │ │
│  ┌──────────────────┐                      │ │
│  │ Redis 7          │                      │ │
│  │ (Cache)          │ ← 永続化不要         │ │
│  │                  │   (コールドスタート)    │ │
│  └──────────────────┘                      │ │
└────────────────────────────────────────────┘ │
                                               │
┌────────────────────────────────────────────┐ │
│  Cross-Region (ap-southeast-1)             │ │
│                                             │ │
│  ┌──────────────────┐                      │ │
│  │ PostgreSQL 16    │◀─────────────────────┘ │
│  │ (Read Replica)   │                        │
│  │                  │                        │
│  │ WAL リプレイ     │                        │
│  └──────────────────┘                        │
└──────────────────────────────────────────────┘
```

| バックアップ対象 | 方式 | 頻度 | 保持期間 |
|----------------|------|------|---------|
| PostgreSQL フルバックアップ | `pg_dump` (論理バックアップ) | 日次 (02:00 JST) | 30日 |
| PostgreSQL WAL アーカイブ | 継続的 WAL アーカイブ | リアルタイム | 7日 |
| PostgreSQL PITR スナップショット | クラウドプロバイダ自動スナップショット | 1時間ごと | 7日 |
| Vercel Blob (ユーザー画像) | クロスリージョンレプリケーション | リアルタイム | 無期限 |
| アプリケーションコード | Git (GitHub) | コミット単位 | 無期限 |

### 8.3 DR 手順

**障害レベル1: アプリケーション障害**

```
1. Vercel ダッシュボードで前バージョンにロールバック
   └─ RTO: 5分以内
2. エラー原因の調査・修正
3. 修正版の再デプロイ
```

**障害レベル2: データベース障害**

```
1. クラウドプロバイダのコンソールでインスタンスステータス確認
2. 自動フェイルオーバーの確認（マネージドDBの場合）
3. 自動復旧しない場合:
   a. 最新の PITR スナップショットから新インスタンスを作成
   b. WAL リプレイで RPO 時点まで復旧
   c. DATABASE_URL 環境変数を新インスタンスに切替え
   d. Vercel で再デプロイ
   └─ RTO: 1〜2時間
```

**障害レベル3: リージョン障害**

```
1. クロスリージョンの Read Replica をプライマリに昇格
2. DNS / 環境変数を新リージョンに切替え
3. Vercel のリージョン設定を変更
4. アプリケーションを再デプロイ
   └─ RTO: 2〜4時間
```

**障害レベル4: Stripe 連携障害**

```
1. Stripe Status Page で障害状況を確認
2. 決済処理を一時停止（フィーチャーフラグ）
3. Stripe 復旧後:
   a. Webhook イベントの再送確認（Stripe ダッシュボード）
   b. 未処理イベントの手動リプレイ
   c. 注文ステータスの整合性チェックバッチ実行
```

**障害レベル5: Redis 障害**

```
1. Redis はキャッシュとして使用（永続データなし）
2. Redis 接続失敗時: キャッシュミスとして処理（DB直接アクセス）
3. 新 Redis インスタンスをプロビジョニング
4. キャッシュはアプリケーション起動時にオンデマンドで再構築
   └─ RTO: 30分以内
```

### 8.4 年次 DR ドリル

| 項目 | 内容 |
|------|------|
| 実施頻度 | 年1回（毎年4月に実施） |
| 参加者 | 開発チーム全員 + 運用担当者 |
| シナリオ | DB フェイルオーバー + Stripe Webhook リプレイ |
| 手順 | staging 環境でフルドリルを実施 |
| 成果物 | DR ドリルレポート（実測 RTO, 手順改善点） |

### 8.5 インシデント対応フロー

```
┌──────────┐
│ 1. 検知   │  モニタリング / アラート / ユーザー報告
└────┬─────┘
     │
┌────▼─────┐
│ 2. 分類   │  P1〜P4 の重要度判定
│  (Triage) │  担当者アサイン
└────┬─────┘
     │
┌────▼──────────┐
│ 3. コミュニケ  │  ステータスページ更新
│  ーション      │  Slack #incident チャネルに投稿
└────┬──────────┘
     │
┌────▼─────┐
│ 4. 解決   │  原因調査 → 修正適用 → 復旧確認
│ (Resolve) │
└────┬─────┘
     │
┌────▼─────────┐
│ 5. ポスト     │  48時間以内にポストモーテム作成
│  モーテム     │  - タイムライン
│              │  - 根本原因分析 (5 Whys)
│              │  - 再発防止策
│              │  - アクションアイテム
└──────────────┘
```

**ポストモーテムテンプレート:**

| セクション | 内容 |
|-----------|------|
| 概要 | 障害の概要（1〜2行） |
| 影響範囲 | 影響を受けたユーザー数・機能・期間 |
| タイムライン | 検知→対応→解決の時系列 |
| 根本原因 | 5 Whys 分析 |
| 対応内容 | 実施した復旧作業 |
| 再発防止策 | 短期・中期・長期のアクション |
| 教訓 | 学んだこと |

---

## 9. マイグレーション戦略

### 9.1 Drizzle Kit によるスキーママイグレーション

**ワークフロー:**

```
1. スキーマファイル編集
   └─ packages/db/src/schema/*.ts

2. マイグレーション生成
   └─ npx drizzle-kit generate
   └─ drizzle/ ディレクトリに SQL ファイルが生成される

3. マイグレーション確認
   └─ 生成された SQL をレビュー
   └─ 後方互換性の確認

4. ローカルで適用テスト
   └─ npx drizzle-kit migrate
   └─ アプリケーション動作確認

5. PR にマイグレーションファイルを含めてレビュー

6. デプロイ時にマイグレーション適用
   └─ CI/CD パイプラインでデプロイ前に実行
```

**drizzle.config.ts:**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### 9.2 データマイグレーションパターン

**Expand-Contract パターン（ゼロダウンタイム）:**

カラム名変更やデータ型変更など、破壊的変更をゼロダウンタイムで行う。

```
Phase 1: Expand（拡張）
  ├─ 新カラムを追加（NULL 許容）
  ├─ デプロイ: 新旧両カラムに書き込むコード
  └─ バックフィル: 既存データを新カラムにコピー

Phase 2: Migrate（移行）
  ├─ デプロイ: 新カラムから読み取るコード
  └─ 旧カラムへの書き込みは継続（ロールバック対応）

Phase 3: Contract（縮小）
  ├─ デプロイ: 旧カラムへの書き込みを停止
  └─ 次回マイグレーション: 旧カラムを削除
```

**実例: `orders.status` VARCHAR → ENUM 変更**

```sql
-- Phase 1: Expand
ALTER TABLE orders ADD COLUMN status_new order_status_enum;
UPDATE orders SET status_new = status::order_status_enum;

-- Phase 2: Migrate (コード変更で新カラムを使用)

-- Phase 3: Contract
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_new TO status;
```

**絶対に守るルール:**

| ルール | 説明 |
|--------|------|
| 同一デプロイでカラム削除禁止 | コード変更とカラム削除を同時に行わない |
| NOT NULL 制約は段階的に | まず NULL 許容で追加 → バックフィル → NOT NULL 追加 |
| インデックスは CONCURRENTLY | `CREATE INDEX CONCURRENTLY` でロックを回避 |
| 大量 UPDATE は分割 | バックフィルは 1,000 行ずつバッチ処理 |

### 9.3 シードデータ管理

**マスタデータ:**

| データ | 件数 | 管理方法 |
|--------|------|---------|
| 香料 (flavors) | 26種 | マイグレーションスクリプトで管理 |
| テーマ (scenes + moods) | 30テーマ (6 x 5) | マイグレーションスクリプトで管理 |
| キーワード (keywords) | 16種 (プリセット) | マイグレーションスクリプトで管理 |
| 商品カテゴリ | 数種 | マイグレーションスクリプトで管理 |
| ベースAIルール (keyword_flavor_rules) | 約480件 (16キーワード x 30テーマ) | マイグレーションスクリプトで管理 |

```typescript
// packages/db/src/seed/master-data.ts

export const MASTER_FLAVORS = [
  // TOP (8種)
  { nameJa: 'ライム', nameEn: 'Lime', noteType: 'TOP', sortOrder: 1 },
  { nameJa: 'グレープフルーツ', nameEn: 'Grapefruit', noteType: 'TOP', sortOrder: 2 },
  { nameJa: 'レモン', nameEn: 'Lemon', noteType: 'TOP', sortOrder: 3 },
  { nameJa: 'オレンジ', nameEn: 'Orange', noteType: 'TOP', sortOrder: 4 },
  { nameJa: 'ベルガモット', nameEn: 'Bergamot', noteType: 'TOP', sortOrder: 5 },
  { nameJa: 'シーブルー', nameEn: 'Sea Blue', noteType: 'TOP', sortOrder: 6 },
  { nameJa: 'アッサムティ', nameEn: 'Assam Tea', noteType: 'TOP', sortOrder: 7 },
  { nameJa: 'カシス', nameEn: 'Cassis', noteType: 'TOP', sortOrder: 8 },
  // MIDDLE (10種)
  { nameJa: 'ラベンダー', nameEn: 'Lavender', noteType: 'MIDDLE', sortOrder: 9 },
  { nameJa: 'ダフネ', nameEn: 'Daphne', noteType: 'MIDDLE', sortOrder: 10 },
  // ... 残り省略
  // LAST (8種)
  { nameJa: 'ブラックペッパー', nameEn: 'Black Pepper', noteType: 'LAST', sortOrder: 19 },
  // ... 残り省略
] as const;

export const MASTER_KEYWORDS = [
  { word: '春', category: 'SEASON', isPreset: true },
  { word: '夏', category: 'SEASON', isPreset: true },
  { word: '秋', category: 'SEASON', isPreset: true },
  { word: '冬', category: 'SEASON', isPreset: true },
  { word: 'まろやか', category: 'PLACE', isPreset: true },
  { word: 'さわやか', category: 'PLACE', isPreset: true },
  { word: 'ナチュラル', category: 'MOOD', isPreset: true },
  { word: '陽気', category: 'MOOD', isPreset: true },
  { word: '優雅', category: 'MOOD', isPreset: true },
  { word: '高級', category: 'MOOD', isPreset: true },
  { word: 'リラックス', category: 'MOOD', isPreset: true },
  { word: 'ロマンティック', category: 'MOOD', isPreset: true },
  { word: '柑橘系', category: 'FREE', isPreset: true },
  { word: '花束', category: 'FREE', isPreset: true },
  { word: 'ウッディ', category: 'FREE', isPreset: true },
  { word: 'スパイシー', category: 'FREE', isPreset: true },
] as const;
```

**環境別シードデータ:**

| 環境 | シードデータ | 生成方法 |
|------|-----------|---------|
| Development | マスタデータ + テストデータ (100ユーザー, 50レシピ, 200注文) | `faker.js` で生成 |
| Staging | マスタデータ + テストデータ (同上) | `faker.js` で生成 |
| Production | マスタデータのみ | マイグレーションスクリプト |

```typescript
// packages/db/src/seed/dev-data.ts
import { faker } from '@faker-js/faker/locale/ja';

export async function seedDevData(db: DB) {
  // テストユーザー 100名
  const users = Array.from({ length: 100 }, () => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    role: faker.helpers.weightedArrayElement([
      { value: 'CUSTOMER', weight: 80 },
      { value: 'CREATOR', weight: 15 },
      { value: 'ADMIN', weight: 5 },
    ]),
  }));

  await db.insert(usersTable).values(users);

  // テストレシピ、テスト注文 等...
}
```

**マスタデータ更新手順:**

```
1. packages/db/src/seed/master-data.ts を更新
2. マイグレーションスクリプトを作成:
   └─ drizzle/XXXX_update_master_data.sql
   └─ INSERT ... ON CONFLICT DO UPDATE（upsert）
3. PR レビュー
4. デプロイ時にマイグレーション適用
```

### 9.4 バージョン追跡

Drizzle Kit は `drizzle/meta/_journal.json` でマイグレーション履歴を管理する。

```json
// drizzle/meta/_journal.json (例)
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1708000000000,
      "tag": "0000_initial_schema",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1708100000000,
      "tag": "0001_add_creator_profiles",
      "breakpoints": true
    }
  ]
}
```

| ファイル | 用途 |
|---------|------|
| `drizzle/XXXX_*.sql` | マイグレーション SQL ファイル |
| `drizzle/meta/_journal.json` | マイグレーション履歴（適用順序の管理） |
| `drizzle/meta/XXXX_snapshot.json` | 各マイグレーション時点のスキーマスナップショット |

**運用ルール:**

| ルール | 説明 |
|--------|------|
| マイグレーションファイルの編集禁止 | 一度生成されたマイグレーションは編集しない。修正が必要な場合は新しいマイグレーションを追加 |
| journal.json のコミット | `_journal.json` は必ず Git にコミットする |
| 環境間の同期 | 全環境で同じマイグレーション履歴を維持する |
| 命名規則 | `XXXX_<説明的な名前>` （例: `0005_add_order_cancel_fields`） |

---

## 変更履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-02-17 | 1.0 | 初版作成。バッチジョブ、DB接続プール、CDN最適化、構造化ログ、アラート・モニタリング、デプロイメント戦略、負荷テスト計画、災害復旧、マイグレーション戦略の9セクションを策定 |
