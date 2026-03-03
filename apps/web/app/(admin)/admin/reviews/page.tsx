import { db } from "@/lib/db";
import {
  recipeReviews,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";
import { ReviewsManager } from "./reviews-manager";

export default async function AdminReviewsPage() {
  const allReviews = await db
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          レビュー管理
        </h1>
        <p className="text-sm text-gray-400">{allReviews.length}件のレビュー</p>
      </div>
      <ReviewsManager initialReviews={allReviews} />
    </div>
  );
}
