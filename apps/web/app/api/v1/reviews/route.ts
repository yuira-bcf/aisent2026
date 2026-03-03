import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  createReviewSchema,
  submitReview,
} from "@/lib/services/review-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/reviews
 *
 * Submit a review for a recipe (requires DELIVERED order).
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  try {
    const result = await submitReview(authResult.userId, parsed.data);
    return apiSuccess({ reviewId: result.reviewId }, 201);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "レビューの投稿に失敗しました";
    return VALIDATION_ERROR(message);
  }
});
