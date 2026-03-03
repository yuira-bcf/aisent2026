import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getCreatorDetail } from "@/lib/services/creator-profile-service";
import { creatorProfiles } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creators/:slug
 *
 * Public creator detail by slug.
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const { slug } = await ctx.params;

  const [profile] = await db
    .select({ userId: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(
      and(
        eq(creatorProfiles.creatorIdSlug, slug),
        eq(creatorProfiles.isActive, true),
      ),
    );

  if (!profile) return NOT_FOUND("クリエイターが見つかりません");

  const detail = await getCreatorDetail(profile.userId);

  if (!detail) return NOT_FOUND("クリエイターが見つかりません");

  return apiSuccess({ creator: detail });
});
