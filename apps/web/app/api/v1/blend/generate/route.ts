import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { blendInputSchema, executeBlend } from "@/lib/services/blend-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/blend/generate
 *
 * Full blend generation flow (requires auth).
 * Creates blend request, calculates, generates story.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = blendInputSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const result = await executeBlend({
    userId: authResult.userId,
    ...parsed.data,
  });

  return apiSuccess(result, 201);
});
