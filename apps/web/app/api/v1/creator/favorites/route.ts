import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getMyFavoriteCreators,
  toggleFavorite,
} from "@/lib/services/creator-profile-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const toggleFavoriteSchema = z.object({
  creatorUserId: z.string().uuid(),
});

/**
 * GET /api/v1/creator/favorites
 *
 * List current user's favorite creators.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total } = await getMyFavoriteCreators(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    favorites: items,
    pagination: paginationMeta(total, page, limit),
  });
});

/**
 * POST /api/v1/creator/favorites
 *
 * Toggle favorite on a creator.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = toggleFavoriteSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const result = await toggleFavorite(
    authResult.userId,
    parsed.data.creatorUserId,
  );

  return apiSuccess(result);
});
