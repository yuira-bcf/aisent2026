/**
 * 監査ログサービス
 *
 * セキュリティ上重要な操作を記録する。監査ログは追記専用であり、
 * 不正アクセスの検知やインシデント調査に利用する。
 */

import { db } from "@/lib/db";
import type { AuditAction } from "@kyarainnovate/db/schema";
import { auditLogs } from "@kyarainnovate/db/schema";

// ---------------------------------------------------------------------------
// 監査ログ パラメータ型
// ---------------------------------------------------------------------------

export type AuditLogParams = {
  /** 操作を実行したユーザーのID（未認証操作の場合はnull） */
  userId: string | null;
  /** アクション種別 */
  action: AuditAction;
  /** 操作対象リソース種別（例: 'user', 'order', 'recipe'） */
  resource: string;
  /** 操作対象リソースのID */
  resourceId?: string;
  /** 追加メタデータ（変更前後の値、エラー詳細等） */
  metadata?: Record<string, unknown>;
  /** HTTPリクエストオブジェクト（IPアドレス・User-Agent取得用） */
  request?: Request;
};

// ---------------------------------------------------------------------------
// リクエスト情報抽出ヘルパー
// ---------------------------------------------------------------------------

/**
 * リクエストからIPアドレスを抽出する
 */
function extractIpAddress(request: Request): string | null {
  // X-Forwarded-For ヘッダーから取得（リバースプロキシ経由の場合）
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // X-Real-IP ヘッダーから取得
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

/**
 * リクエストからUser-Agentを抽出する
 */
function extractUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}

// ---------------------------------------------------------------------------
// 監査ログ記録関数
// ---------------------------------------------------------------------------

/**
 * 監査ログを記録する
 *
 * セキュリティ上重要な操作をDBの `audit_logs` テーブルに追記する。
 * ログ記録の失敗がリクエスト処理をブロックしないよう、エラーは
 * ログ出力のみ行い例外を再スローしない。
 *
 * @param params - 監査ログパラメータ
 *
 * @example
 * ```typescript
 * // ログイン成功時
 * await auditLog({
 *   userId: user.id,
 *   action: 'LOGIN',
 *   resource: 'user',
 *   resourceId: user.id,
 *   request,
 * });
 *
 * // 注文ステータス変更時
 * await auditLog({
 *   userId: adminUser.id,
 *   action: 'ORDER_STATUS_CHANGE',
 *   resource: 'order',
 *   resourceId: order.id,
 *   metadata: {
 *     previousStatus: 'PENDING',
 *     newStatus: 'SHIPPED',
 *   },
 *   request,
 * });
 *
 * // ログイン失敗時（ユーザーID不明）
 * await auditLog({
 *   userId: null,
 *   action: 'LOGIN_FAILED',
 *   resource: 'user',
 *   metadata: { email: 'unknown@example.com' },
 *   request,
 * });
 * ```
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    const { userId, action, resource, resourceId, metadata, request } = params;

    // リクエスト情報の抽出
    const ipAddress = request ? extractIpAddress(request) : null;
    const userAgent = request ? extractUserAgent(request) : null;

    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      resourceId: resourceId ?? null,
      metadata: metadata ?? null,
      ipAddress,
      userAgent,
    });

    // 開発環境ではコンソールにも出力
    if (process.env.NODE_ENV === "development") {
      console.log("[audit]", {
        userId,
        action,
        resource,
        resourceId,
        metadata,
        ipAddress,
        userAgent: userAgent?.substring(0, 50),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // 監査ログの記録失敗がリクエスト処理をブロックしないよう、
    // エラーはログ出力のみ行い例外を再スローしない
    console.error("[audit-logger] 監査ログの記録に失敗しました:", error);
  }
}

// ---------------------------------------------------------------------------
// 便利関数: よく使う監査ログパターン
// ---------------------------------------------------------------------------

/**
 * ログイン成功を記録する
 */
export async function auditLoginSuccess(
  userId: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId,
    action: "LOGIN",
    resource: "user",
    resourceId: userId,
    request,
  });
}

/**
 * ログイン失敗を記録する
 */
export async function auditLoginFailure(
  email: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId: null,
    action: "LOGIN_FAILED",
    resource: "user",
    metadata: { email },
    request,
  });
}

/**
 * ログアウトを記録する
 */
export async function auditLogout(
  userId: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId,
    action: "LOGOUT",
    resource: "user",
    resourceId: userId,
    request,
  });
}

/**
 * パスワードリセット申請を記録する
 */
export async function auditPasswordResetRequest(
  userId: string | null,
  email: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId,
    action: "PASSWORD_RESET_REQUEST",
    resource: "user",
    resourceId: userId ?? undefined,
    metadata: { email },
    request,
  });
}

/**
 * パスワードリセット実行を記録する
 */
export async function auditPasswordReset(
  userId: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId,
    action: "PASSWORD_RESET",
    resource: "user",
    resourceId: userId,
    request,
  });
}

/**
 * 注文ステータス変更を記録する
 */
export async function auditOrderStatusChange(
  userId: string,
  orderId: string,
  previousStatus: string,
  newStatus: string,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId,
    action: "ORDER_STATUS_CHANGE",
    resource: "order",
    resourceId: orderId,
    metadata: { previousStatus, newStatus },
    request,
  });
}

/**
 * 管理者操作を記録する
 */
export async function auditAdminAction(
  adminUserId: string,
  resource: string,
  resourceId: string,
  description: string,
  metadata?: Record<string, unknown>,
  request?: Request,
): Promise<void> {
  await auditLog({
    userId: adminUserId,
    action: "ADMIN_ACTION",
    resource,
    resourceId,
    metadata: { description, ...metadata },
    request,
  });
}
