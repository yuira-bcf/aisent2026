import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getCreatorStyle,
  updateCreatorStyle,
} from "@/lib/services/creator-profile-service";
import { updateStyleSchema } from "@/lib/validations/creator";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/style
 *
 * Get own creator style profile. CREATOR or ADMIN only.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const style = await getCreatorStyle(authResult.userId);

  if (!style) return NOT_FOUND("スタイルプロフィールが見つかりません");

  return apiSuccess({ style });
});

/**
 * PUT /api/v1/creator/style
 *
 * Update own creator style profile. CREATOR or ADMIN only.
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = updateStyleSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateCreatorStyle(authResult.userId, parsed.data);

  return apiSuccess({ style: updated });
});
