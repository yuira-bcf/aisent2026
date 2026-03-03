import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { publishRecipe } from "@/lib/services/recipe-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/creator/recipes/:id/publish
 *
 * Publish a recipe. CREATOR or ADMIN only.
 */
export const POST = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const ok = await publishRecipe(authResult.userId, id);

  if (!ok) return NOT_FOUND("レシピが見つかりません");

  return apiSuccess({ published: true });
});
