import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { creatorProfiles, profileVisitors } from "@kyarainnovate/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const POST = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { slug } = await ctx.params;

  // Find creator by slug
  const [profile] = await db
    .select({ userId: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.creatorIdSlug, slug));

  if (!profile) return NOT_FOUND("クリエイターが見つかりません");

  // Don't record self-visits
  if (profile.userId === authResult.userId) {
    return apiSuccess({ recorded: false });
  }

  // Check if already visited today (1 visit per day per user)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ id: profileVisitors.id })
    .from(profileVisitors)
    .where(
      and(
        eq(profileVisitors.creatorId, profile.userId),
        eq(profileVisitors.visitorId, authResult.userId),
        sql`${profileVisitors.visitedAt} >= ${today}`,
      ),
    );

  if (existing) {
    return apiSuccess({ recorded: false });
  }

  await db.insert(profileVisitors).values({
    creatorId: profile.userId,
    visitorId: authResult.userId,
  });

  return apiSuccess({ recorded: true }, 201);
});
