import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { suggestRulesForKeyword } from "@/lib/services/creator-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/creator/keywords/:id/suggest
 *
 * Get AI-suggested rules for a keyword.
 */
export const POST = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const suggestions = await suggestRulesForKeyword(id, authResult.userId);

  return apiSuccess({ suggestions });
});
