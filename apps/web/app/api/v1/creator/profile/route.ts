import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getCreatorProfile,
  updateCreatorProfile,
} from "@/lib/services/creator-profile-service";
import { updateProfileSchema } from "@/lib/validations/creator";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/profile
 *
 * Get own creator profile. CREATOR or ADMIN only.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const profile = await getCreatorProfile(authResult.userId);

  if (!profile) return NOT_FOUND("プロフィールが見つかりません");

  return apiSuccess({ profile });
});

/**
 * PUT /api/v1/creator/profile
 *
 * Update own creator profile. CREATOR or ADMIN only.
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateCreatorProfile(authResult.userId, parsed.data);

  return apiSuccess({ profile: updated });
});
