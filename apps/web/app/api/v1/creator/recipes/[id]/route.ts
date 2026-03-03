import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  archiveRecipe,
  getRecipeDetail,
  updateRecipe,
  updateRecipeSchema,
} from "@/lib/services/recipe-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/recipes/:id
 *
 * Get recipe detail.
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const recipe = await getRecipeDetail(id);

  if (!recipe) return NOT_FOUND("レシピが見つかりません");

  return apiSuccess({ recipe });
});

/**
 * PUT /api/v1/creator/recipes/:id
 *
 * Update a recipe. CREATOR or ADMIN only.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateRecipeSchema.safeParse({ ...body, recipeId: id });

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const ok = await updateRecipe(authResult.userId, parsed.data);

  if (!ok) return NOT_FOUND("レシピが見つかりません");

  return apiSuccess({ updated: true });
});

/**
 * DELETE /api/v1/creator/recipes/:id
 *
 * Archive a recipe. CREATOR or ADMIN only.
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const ok = await archiveRecipe(authResult.userId, id);

  if (!ok) return NOT_FOUND("レシピが見つかりません");

  return apiSuccess({ archived: true });
});
