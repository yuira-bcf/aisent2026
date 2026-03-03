import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  recipeReviews,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/v1/admin/reviews
 *
 * Admin only. List all recipe reviews with user and recipe info.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const items = await db
    .select({
      id: recipeReviews.id,
      rating: recipeReviews.rating,
      title: recipeReviews.title,
      comment: recipeReviews.comment,
      isVisible: recipeReviews.isVisible,
      isVerifiedPurchase: recipeReviews.isVerifiedPurchase,
      createdAt: recipeReviews.createdAt,
      userName: users.name,
      userEmail: users.email,
      recipeName: signatureRecipes.name,
    })
    .from(recipeReviews)
    .leftJoin(users, eq(recipeReviews.userId, users.id))
    .leftJoin(signatureRecipes, eq(recipeReviews.recipeId, signatureRecipes.id))
    .orderBy(desc(recipeReviews.createdAt));

  return apiSuccess({ reviews: items });
});
