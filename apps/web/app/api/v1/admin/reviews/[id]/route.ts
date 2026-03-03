import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { recipeReviews } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * PATCH /api/v1/admin/reviews/:id
 *
 * Admin only. Toggle review visibility.
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(recipeReviews)
    .where(eq(recipeReviews.id, id));

  if (!existing) return NOT_FOUND("レビューが見つかりません");

  const [review] = await db
    .update(recipeReviews)
    .set({ isVisible: Boolean(body.isVisible) })
    .where(eq(recipeReviews.id, id))
    .returning();

  return apiSuccess({ review });
});
