import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import {
  getRecommendedCreators,
  getRecommendedRecipes,
} from "@/lib/services/personalization-service";

export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const [recipes, creators] = await Promise.all([
    getRecommendedRecipes(authResult.userId),
    getRecommendedCreators(authResult.userId),
  ]);

  return apiSuccess({ recipes, creators });
});
