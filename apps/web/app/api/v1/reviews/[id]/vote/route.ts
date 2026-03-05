import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { toggleReviewVote } from "@/lib/services/review-service";
import type { NextRequest } from "next/server";

export const POST = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const result = await toggleReviewVote(id, authResult.userId);
  return apiSuccess(result);
});
