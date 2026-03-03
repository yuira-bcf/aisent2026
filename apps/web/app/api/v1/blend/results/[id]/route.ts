import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getBlendResultDetail,
  updateBlendName,
} from "@/lib/services/blend-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/v1/blend/results/:id
 *
 * Get blend result detail (owner only).
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const detail = await getBlendResultDetail(id, authResult.userId);

  if (!detail) return NOT_FOUND("調合結果が見つかりません");

  return apiSuccess(detail);
});

const patchSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * PATCH /api/v1/blend/results/:id
 *
 * Update blend name (owner only).
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateBlendName(
    id,
    authResult.userId,
    parsed.data.name,
  );

  if (!updated) return NOT_FOUND("調合結果が見つかりません");

  return apiSuccess({ updated: true });
});
