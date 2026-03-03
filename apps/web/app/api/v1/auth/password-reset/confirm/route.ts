import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiError, apiSuccess } from "@/lib/api/response";
import { resetPassword } from "@/lib/services/password-reset-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const confirmSchema = z.object({
  token: z.string().min(1, "トークンが必要です"),
  newPassword: z
    .string()
    .min(8, "パスワードは8文字以上にしてください")
    .max(128, "パスワードは128文字以内にしてください"),
});

/**
 * POST /api/v1/auth/password-reset/confirm
 *
 * Reset password using a valid token.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = confirmSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const success = await resetPassword(
    parsed.data.token,
    parsed.data.newPassword,
  );

  if (!success) {
    return apiError("INVALID_TOKEN", "トークンが無効または期限切れです", 400);
  }

  return apiSuccess({ message: "パスワードが変更されました" });
});
