/**
 * セキュリティヘッダーミドルウェア
 *
 * CSP、X-Frame-Options、X-Content-Type-Options 等のセキュリティヘッダーを
 * 一括で生成する。Next.js の middleware.ts や next.config.ts で使用する。
 */

// ---------------------------------------------------------------------------
// CSP nonce 生成
// ---------------------------------------------------------------------------

/**
 * CSP用のnonce値を生成する
 *
 * @returns Base64エンコードされたランダムnonce文字列
 */
export function generateCspNonce(): string {
  // TODO: crypto.randomBytes を使用してセキュアなnonce生成
  // Node.js環境:
  //   const crypto = await import('node:crypto');
  //   return crypto.randomBytes(16).toString('base64');
  //
  // Edge Runtime環境:
  //   const array = new Uint8Array(16);
  //   crypto.getRandomValues(array);
  //   return btoa(String.fromCharCode(...array));

  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// ---------------------------------------------------------------------------
// Content-Security-Policy 構築
// ---------------------------------------------------------------------------

/**
 * Content-Security-Policyヘッダー値を生成する
 *
 * @param nonce - スクリプト用nonce値（省略時はnonce無し）
 * @returns CSPヘッダー文字列
 */
export function buildCsp(nonce?: string): string {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : `'self'`;

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // CSS-in-JSライブラリとの互換性のため 'unsafe-inline' を許可
    // 将来的にはnonce方式に移行する
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    // Stripe API等の外部接続先を許可
    `connect-src 'self' https://api.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    // 本番環境ではHTTPSへの自動アップグレードを強制
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ];

  return directives.join("; ");
}

// ---------------------------------------------------------------------------
// セキュリティヘッダー一括生成
// ---------------------------------------------------------------------------

/**
 * セキュリティヘッダーを一括で生成する
 *
 * Next.js の middleware.ts でレスポンスヘッダーに設定する、
 * または next.config.ts の headers() で使用する。
 *
 * @param options - オプション
 * @param options.nonce - CSP用nonce値（省略時は自動生成）
 * @returns ヘッダーオブジェクト
 *
 * @example
 * ```typescript
 * // middleware.ts での使用例
 * import { securityHeaders, generateCspNonce } from '@/lib/api/security-headers';
 *
 * export function middleware(request: NextRequest) {
 *   const nonce = generateCspNonce();
 *   const headers = securityHeaders({ nonce });
 *   const response = NextResponse.next();
 *
 *   for (const [key, value] of Object.entries(headers)) {
 *     response.headers.set(key, value);
 *   }
 *
 *   // nonceをリクエストヘッダーに設定してServer Componentから参照可能にする
 *   response.headers.set('x-nonce', nonce);
 *
 *   return response;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // next.config.ts での使用例（静的ヘッダー、nonce無し）
 * import { securityHeaders } from '@/lib/api/security-headers';
 *
 * const config = {
 *   async headers() {
 *     const headers = securityHeaders();
 *     return [
 *       {
 *         source: '/(.*)',
 *         headers: Object.entries(headers).map(([key, value]) => ({
 *           key,
 *           value,
 *         })),
 *       },
 *     ];
 *   },
 * };
 * ```
 */
export function securityHeaders(options?: {
  nonce?: string;
}): Record<string, string> {
  const nonce = options?.nonce;

  const headers: Record<string, string> = {
    // Content-Security-Policy
    "Content-Security-Policy": buildCsp(nonce),

    // クリックジャッキング防止
    "X-Frame-Options": "DENY",

    // MIMEタイプスニッフィング防止
    "X-Content-Type-Options": "nosniff",

    // リファラー情報の制限
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // 不要なブラウザAPIの無効化
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",

    // DNS先読み無効化
    "X-DNS-Prefetch-Control": "off",
  };

  // 本番環境のみ HSTS を有効化
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Next.js headers() 形式への変換ヘルパー
// ---------------------------------------------------------------------------

/**
 * Record<string, string> 形式のヘッダーを Next.js の headers() 形式に変換する
 *
 * @param headers - ヘッダーオブジェクト
 * @returns Next.js の headers() 設定で使用できる配列形式
 *
 * @example
 * ```typescript
 * // next.config.ts
 * import { securityHeaders, toNextHeaders } from '@/lib/api/security-headers';
 *
 * const config = {
 *   async headers() {
 *     return [
 *       {
 *         source: '/(.*)',
 *         headers: toNextHeaders(securityHeaders()),
 *       },
 *     ];
 *   },
 * };
 * ```
 */
export function toNextHeaders(
  headers: Record<string, string>,
): Array<{ key: string; value: string }> {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}
