import { safeHandler } from "@/lib/api/handler";
import {
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  rateLimitKey,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limiter";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

/**
 * POST /api/v1/auth/password-reset/request
 *
 * Request a password reset email. Always returns success to prevent email enumeration.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  const rlResult = await rateLimit(
    rateLimitKey("PASSWORD_RESET", ip),
    RATE_LIMITS.PASSWORD_RESET.limit,
    RATE_LIMITS.PASSWORD_RESET.windowSeconds,
  );
  if (!rlResult.allowed) {
    return tooManyRequestsResponse(rlResult, RATE_LIMITS.PASSWORD_RESET.limit);
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  await requestPasswordReset(parsed.data.email);

  // Always return success to prevent email enumeration
  return apiSuccess({ message: "リセットメールを送信しました" });
});
