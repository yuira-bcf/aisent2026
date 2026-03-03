import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getRulesForKeyword,
  saveRulesForKeyword,
} from "@/lib/services/creator-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/v1/creator/keywords/:id/rules
 *
 * Get rules for a keyword by the authenticated creator.
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const rules = await getRulesForKeyword(id, authResult.userId);

  return apiSuccess({ rules });
});

const putSchema = z.object({
  rules: z
    .array(
      z.object({
        flavorId: z.string().uuid(),
        weight: z.number().min(0).max(1),
        noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
      }),
    )
    .min(1, "ルールを1つ以上追加してください"),
});

/**
 * PUT /api/v1/creator/keywords/:id/rules
 *
 * Replace all rules for a keyword by the authenticated creator.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  await saveRulesForKeyword(id, authResult.userId, parsed.data.rules);

  return apiSuccess({ saved: true });
});
