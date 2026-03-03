import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  approveCreatorApplication,
  rejectCreatorApplication,
} from "@/lib/services/creator-profile-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const reviewSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().min(1).optional(),
});

/**
 * POST /api/v1/admin/creators/:id/review
 *
 * Admin only. Approve or reject a creator application.
 */
export const POST = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  let success: boolean;

  if (parsed.data.approve) {
    success = await approveCreatorApplication(id, authResult.userId);
  } else {
    success = await rejectCreatorApplication(
      id,
      authResult.userId,
      parsed.data.rejectionReason ?? "理由なし",
    );
  }

  return apiSuccess({ success });
});
