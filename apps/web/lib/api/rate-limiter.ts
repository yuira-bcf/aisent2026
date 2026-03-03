/**
 * レート制限ミドルウェア
 *
 * Redis Sliding Windowカウンターによるレート制限を実装する。
 * Redis未接続時はフォールバックとしてリクエストを許可する（可用性優先）。
 */

// ---------------------------------------------------------------------------
// レート制限カテゴリ定義
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  /** 一般API: 100リクエスト/分 */
  GENERAL: { limit: 100, windowSeconds: 60 },
  /** 認証系エンドポイント: 10リクエスト/分 */
  AUTH: { limit: 10, windowSeconds: 60 },
  /** ブレンドリクエスト: 30リクエスト/分 */
  BLEND: { limit: 30, windowSeconds: 60 },
  /** パスワードリセット: 5リクエスト/分 */
  PASSWORD_RESET: { limit: 5, windowSeconds: 60 },
} as const;

export type RateLimitCategory = keyof typeof RATE_LIMITS;

// ---------------------------------------------------------------------------
// レート制限の結果型
// ---------------------------------------------------------------------------

export type RateLimitResult = {
  /** リクエストが許可されたかどうか */
  allowed: boolean;
  /** 残りリクエスト数 */
  remaining: number;
  /** 制限リセット日時 */
  resetAt: Date;
};

// ---------------------------------------------------------------------------
// レート制限ヘッダー型
// ---------------------------------------------------------------------------

export type RateLimitHeaders = {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
};

// ---------------------------------------------------------------------------
// レート制限関数
// ---------------------------------------------------------------------------

/**
 * Redis Sliding Windowカウンターによるレート制限チェック
 *
 * @param key    - 制限キー（例: `auth:192.168.1.1`, `general:user-uuid`）
 * @param limit  - ウィンドウ内の最大リクエスト数
 * @param windowSeconds - ウィンドウサイズ（秒）
 * @returns レート制限の結果
 *
 * @example
 * ```typescript
 * const result = await rateLimit(
 *   `auth:${ipAddress}`,
 *   RATE_LIMITS.AUTH.limit,
 *   RATE_LIMITS.AUTH.windowSeconds,
 * );
 *
 * if (!result.allowed) {
 *   return TOO_MANY_REQUESTS(result);
 * }
 * ```
 */
// ---------------------------------------------------------------------------
// インメモリ Sliding Window ストア
// ---------------------------------------------------------------------------

const requestStore = new Map<string, number[]>();

// 定期的に古いエントリを削除（メモリリーク防止）
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupStore(windowSeconds: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const maxAge = windowSeconds * 1000 * 2;
  for (const [key, timestamps] of requestStore.entries()) {
    const filtered = timestamps.filter((t) => now - t < maxAge);
    if (filtered.length === 0) {
      requestStore.delete(key);
    } else {
      requestStore.set(key, filtered);
    }
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetAt = new Date(now + windowMs);

  cleanupStore(windowSeconds);

  // 既存のタイムスタンプを取得し、ウィンドウ外のものを除去
  const timestamps = requestStore.get(key) ?? [];
  const windowStart = now - windowMs;
  const recentTimestamps = timestamps.filter((t) => t > windowStart);

  if (recentTimestamps.length >= limit) {
    // 制限超過
    requestStore.set(key, recentTimestamps);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // リクエストを記録
  recentTimestamps.push(now);
  requestStore.set(key, recentTimestamps);

  return {
    allowed: true,
    remaining: limit - recentTimestamps.length,
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// リクエストからレート制限キーを生成するヘルパー
// ---------------------------------------------------------------------------

/**
 * リクエストからIPアドレスを取得する
 *
 * @param request - Requestオブジェクト
 * @returns IPアドレス文字列
 */
export function getClientIp(request: Request): string {
  // X-Forwarded-For ヘッダーから取得（リバースプロキシ経由の場合）
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // カンマ区切りの最初のIPを取得（クライアントのIP）
    return forwarded.split(",")[0].trim();
  }

  // X-Real-IP ヘッダーから取得（Nginx等）
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // フォールバック
  return "127.0.0.1";
}

/**
 * レート制限カテゴリに基づいたキーを生成する
 *
 * @param category  - レート制限カテゴリ
 * @param identifier - 識別子（ユーザーID、IPアドレス、メールアドレス等）
 * @returns レート制限キー文字列
 */
export function rateLimitKey(
  category: RateLimitCategory,
  identifier: string,
): string {
  return `${category.toLowerCase()}:${identifier}`;
}

// ---------------------------------------------------------------------------
// レート制限ヘッダー生成ヘルパー
// ---------------------------------------------------------------------------

/**
 * レート制限結果からHTTPレスポンスヘッダーを生成する
 *
 * @param result - レート制限チェック結果
 * @param limit  - 最大リクエスト数
 * @returns ヘッダーオブジェクト
 */
export function rateLimitHeaders(
  result: RateLimitResult,
  limit: number,
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
  };

  if (!result.allowed) {
    const retryAfter = Math.ceil(
      (result.resetAt.getTime() - Date.now()) / 1000,
    );
    headers["Retry-After"] = String(Math.max(1, retryAfter));
  }

  return headers;
}

// ---------------------------------------------------------------------------
// レート制限超過レスポンス生成
// ---------------------------------------------------------------------------

/**
 * 429 Too Many Requests レスポンスを生成する
 *
 * @param result - レート制限チェック結果
 * @param limit  - 最大リクエスト数
 * @returns NextResponse オブジェクト
 */
export function tooManyRequestsResponse(
  result: RateLimitResult,
  limit: number,
): Response {
  const headers = rateLimitHeaders(result, limit);

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message:
          "リクエスト回数の上限を超えました。しばらくしてからお試しください",
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    },
  );
}
