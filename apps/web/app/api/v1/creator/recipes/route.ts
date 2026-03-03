import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  createRecipe,
  createRecipeSchema,
  getRecipesByCreator,
} from "@/lib/services/recipe-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/recipes
 *
 * List recipes for the authenticated creator (paginated).
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total } = await getRecipesByCreator(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    items,
    pagination: paginationMeta(total, page, limit),
  });
});

/**
 * POST /api/v1/creator/recipes
 *
 * Create a new recipe. CREATOR or ADMIN only.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createRecipeSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const { recipeId } = await createRecipe(authResult.userId, parsed.data);

  return apiSuccess({ recipeId }, 201);
});
