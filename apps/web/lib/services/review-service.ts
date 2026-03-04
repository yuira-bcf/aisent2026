import { db } from "@/lib/db";
import { notifyCreatorNewReview } from "@/lib/services/notification-service";
import {
  orders,
  recipeReviews,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

export const createReviewSchema = z.object({
  recipeId: z.string().uuid(),
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewItem = {
  id: string;
  recipeId: string;
  recipeName: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// submitReview – Create a review with validation checks
// ---------------------------------------------------------------------------

export async function submitReview(
  userId: string,
  input: CreateReviewInput,
): Promise<{ reviewId: string }> {
  // 1. Verify order belongs to user and is DELIVERED
  const [order] = await db
    .select({ id: orders.id, userId: orders.userId, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.userId, userId)));

  if (!order) {
    throw new Error("注文が見つかりません");
  }

  if (order.status !== "DELIVERED") {
    throw new Error("配達済みの注文のみレビューできます");
  }

  // 2. Verify recipe exists and is not by the same user (no self-review)
  const [recipe] = await db
    .select({
      id: signatureRecipes.id,
      name: signatureRecipes.name,
      creatorId: signatureRecipes.creatorId,
    })
    .from(signatureRecipes)
    .where(eq(signatureRecipes.id, input.recipeId));

  if (!recipe) {
    throw new Error("レシピが見つかりません");
  }

  if (recipe.creatorId === userId) {
    throw new Error("自分のレシピにはレビューできません");
  }

  // 3. Verify no duplicate review (same orderId + recipeId)
  const existing = await db
    .select({ id: recipeReviews.id })
    .from(recipeReviews)
    .where(
      and(
        eq(recipeReviews.orderId, input.orderId),
        eq(recipeReviews.recipeId, input.recipeId),
      ),
    );

  if (existing.length > 0) {
    throw new Error("この注文に対するレビューは既に投稿済みです");
  }

  // 4. Insert review
  const [review] = await db
    .insert(recipeReviews)
    .values({
      recipeId: input.recipeId,
      userId,
      orderId: input.orderId,
      rating: input.rating,
      title: input.title ?? null,
      comment: input.comment ?? null,
      isVerifiedPurchase: true,
    })
    .returning();

  // Notify creator about new review
  notifyCreatorNewReview(recipe.creatorId, recipe.name, input.rating).catch(
    (err) => console.error("[review-service] notification failed:", err),
  );

  return { reviewId: review.id };
}

// ---------------------------------------------------------------------------
// getReviewsForRecipe – Paginated reviews for a recipe
// ---------------------------------------------------------------------------

export async function getReviewsForRecipe(
  recipeId: string,
  page: number,
  limit: number,
): Promise<{ items: ReviewItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const where = and(
    eq(recipeReviews.recipeId, recipeId),
    eq(recipeReviews.isVisible, true),
  );

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: recipeReviews.id,
        recipeId: recipeReviews.recipeId,
        recipeName: signatureRecipes.name,
        userId: recipeReviews.userId,
        userName: users.name,
        rating: recipeReviews.rating,
        title: recipeReviews.title,
        comment: recipeReviews.comment,
        isVerifiedPurchase: recipeReviews.isVerifiedPurchase,
        createdAt: recipeReviews.createdAt,
      })
      .from(recipeReviews)
      .innerJoin(users, eq(recipeReviews.userId, users.id))
      .innerJoin(
        signatureRecipes,
        eq(recipeReviews.recipeId, signatureRecipes.id),
      )
      .where(where)
      .orderBy(desc(recipeReviews.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(recipeReviews).where(where),
  ]);

  return { items: rows, total };
}

// ---------------------------------------------------------------------------
// getUserReviews – Paginated reviews by a user
// ---------------------------------------------------------------------------

export async function getUserReviews(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: ReviewItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const where = eq(recipeReviews.userId, userId);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: recipeReviews.id,
        recipeId: recipeReviews.recipeId,
        recipeName: signatureRecipes.name,
        userId: recipeReviews.userId,
        userName: users.name,
        rating: recipeReviews.rating,
        title: recipeReviews.title,
        comment: recipeReviews.comment,
        isVerifiedPurchase: recipeReviews.isVerifiedPurchase,
        createdAt: recipeReviews.createdAt,
      })
      .from(recipeReviews)
      .innerJoin(users, eq(recipeReviews.userId, users.id))
      .innerJoin(
        signatureRecipes,
        eq(recipeReviews.recipeId, signatureRecipes.id),
      )
      .where(where)
      .orderBy(desc(recipeReviews.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(recipeReviews).where(where),
  ]);

  return { items: rows, total };
}

// ---------------------------------------------------------------------------
// moderateReview – Admin toggle review visibility
// ---------------------------------------------------------------------------

export async function moderateReview(
  reviewId: string,
  isVisible: boolean,
): Promise<boolean> {
  const result = await db
    .update(recipeReviews)
    .set({ isVisible, updatedAt: new Date() })
    .where(eq(recipeReviews.id, reviewId))
    .returning({ id: recipeReviews.id });

  return result.length > 0;
}
