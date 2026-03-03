import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  deleteFlavor,
  getFlavorById,
  isFlavorReferenced,
  updateFlavor,
  updateFlavorSchema,
} from "@/lib/services/flavor-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/flavors/:id
 *
 * Admin only. Get a single flavor by ID.
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const flavor = await getFlavorById(id);
  if (!flavor) return NOT_FOUND("香料が見つかりません");

  return apiSuccess({ flavor });
});

/**
 * PUT /api/v1/admin/flavors/:id
 *
 * Admin only. Update a flavor.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateFlavorSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  const flavor = await updateFlavor(id, parsed.data);
  if (!flavor) return NOT_FOUND("香料が見つかりません");

  return apiSuccess({ flavor });
});

/**
 * DELETE /api/v1/admin/flavors/:id
 *
 * Admin only. Delete a flavor.
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;

  const referenced = await isFlavorReferenced(id);
  if (referenced)
    return VALIDATION_ERROR(
      "この香料はレシピまたはブレンドで使用されているため削除できません",
    );

  const deleted = await deleteFlavor(id);
  if (!deleted) return NOT_FOUND("香料が見つかりません");

  return apiSuccess({ deleted: true });
});
