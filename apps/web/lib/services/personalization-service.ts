import { db } from "@/lib/db";
import {
  blendRequests,
  blendResultFlavors,
  blendResults,
  creatorProfiles,
  creatorStats,
  flavorPreferences,
  flavors,
  recipeFlavors,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import type { RecipeStatus } from "@kyarainnovate/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

type FlavorPreference = {
  flavorId: string;
  nameJa: string;
  noteType: string;
  totalWeight: number;
};

/** Compute flavor preferences dynamically from blend history */
async function computeFlavorPreferences(
  userId: string,
): Promise<FlavorPreference[]> {
  const userBlends = await db
    .select({ blendResultId: blendResults.id })
    .from(blendRequests)
    .innerJoin(blendResults, eq(blendRequests.id, blendResults.blendRequestId))
    .where(eq(blendRequests.userId, userId))
    .orderBy(desc(blendRequests.createdAt))
    .limit(20);

  if (userBlends.length === 0) return [];

  const resultIds = userBlends.map((b) => b.blendResultId);

  const flavorUsage = await db
    .select({
      flavorId: blendResultFlavors.flavorId,
      nameJa: flavors.nameJa,
      noteType: flavors.noteType,
      totalWeight:
        sql<number>`SUM(CAST(${blendResultFlavors.ratio} AS numeric))`.as(
          "total_weight",
        ),
    })
    .from(blendResultFlavors)
    .innerJoin(flavors, eq(blendResultFlavors.flavorId, flavors.id))
    .where(inArray(blendResultFlavors.blendResultId, resultIds))
    .groupBy(blendResultFlavors.flavorId, flavors.nameJa, flavors.noteType)
    .orderBy(desc(sql`total_weight`))
    .limit(10);

  return flavorUsage;
}

/** Analyze user's blend history to find preferred flavors.
 *  Reads from flavorPreferences table first, falls back to dynamic computation. */
export async function getFlavorPreferences(
  userId: string,
): Promise<FlavorPreference[]> {
  // Try to read from the materialized flavorPreferences table
  const stored = await db
    .select({
      flavorId: flavorPreferences.flavorId,
      nameJa: flavors.nameJa,
      noteType: flavors.noteType,
      totalWeight: flavorPreferences.score,
    })
    .from(flavorPreferences)
    .innerJoin(flavors, eq(flavorPreferences.flavorId, flavors.id))
    .where(eq(flavorPreferences.userId, userId))
    .orderBy(desc(flavorPreferences.score))
    .limit(10);

  if (stored.length > 0) {
    return stored.map((row) => ({
      flavorId: row.flavorId,
      nameJa: row.nameJa,
      noteType: row.noteType,
      totalWeight: Number(row.totalWeight),
    }));
  }

  // Fallback: compute dynamically
  return computeFlavorPreferences(userId);
}

/** Analyze blend history and upsert into flavorPreferences table */
export async function updateFlavorPreferences(userId: string) {
  const userBlends = await db
    .select({ blendResultId: blendResults.id })
    .from(blendRequests)
    .innerJoin(blendResults, eq(blendRequests.id, blendResults.blendRequestId))
    .where(eq(blendRequests.userId, userId))
    .orderBy(desc(blendRequests.createdAt))
    .limit(50);

  if (userBlends.length === 0) return;

  const resultIds = userBlends.map((b) => b.blendResultId);

  const flavorUsage = await db
    .select({
      flavorId: blendResultFlavors.flavorId,
      totalWeight:
        sql<number>`SUM(CAST(${blendResultFlavors.ratio} AS numeric))`.as(
          "total_weight",
        ),
      blendCount:
        sql<number>`COUNT(DISTINCT ${blendResultFlavors.blendResultId})`.as(
          "blend_count",
        ),
    })
    .from(blendResultFlavors)
    .where(inArray(blendResultFlavors.blendResultId, resultIds))
    .groupBy(blendResultFlavors.flavorId)
    .orderBy(desc(sql`total_weight`));

  if (flavorUsage.length === 0) return;

  // Upsert each flavor preference using ON CONFLICT
  for (const usage of flavorUsage) {
    await db
      .insert(flavorPreferences)
      .values({
        userId,
        flavorId: usage.flavorId,
        score: String(usage.totalWeight),
        blendCount: usage.blendCount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [flavorPreferences.userId, flavorPreferences.flavorId],
        set: {
          score: String(usage.totalWeight),
          blendCount: usage.blendCount,
          updatedAt: new Date(),
        },
      });
  }
}

/** Return user's personalization summary */
export async function getPersonalizationSummary(userId: string) {
  const prefs = await getFlavorPreferences(userId);

  // Note type breakdown
  const noteBreakdown: Record<string, number> = { TOP: 0, MIDDLE: 0, LAST: 0 };
  for (const p of prefs) {
    noteBreakdown[p.noteType] =
      (noteBreakdown[p.noteType] ?? 0) + p.totalWeight;
  }
  const totalWeight = Object.values(noteBreakdown).reduce((a, b) => a + b, 0);
  const noteTypeRatios =
    totalWeight > 0
      ? {
          TOP: Math.round((noteBreakdown.TOP / totalWeight) * 100),
          MIDDLE: Math.round((noteBreakdown.MIDDLE / totalWeight) * 100),
          LAST: Math.round((noteBreakdown.LAST / totalWeight) * 100),
        }
      : { TOP: 0, MIDDLE: 0, LAST: 0 };

  // Recommended creators count
  const recommendedCreators = await getRecommendedCreators(userId);

  // Taste preferences from user profile
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tastePreferences: true },
  });

  return {
    topFlavors: prefs,
    noteTypeRatios,
    recommendedCreatorsCount: recommendedCreators.length,
    tastePreferences: user?.tastePreferences ?? null,
  };
}

/** Recommend recipes based on user's flavor preferences */
export async function getRecommendedRecipes(userId: string, limit = 6) {
  const prefs = await getFlavorPreferences(userId);

  if (prefs.length === 0) {
    // Fallback: return popular recipes
    const recipes = await db
      .select({
        id: signatureRecipes.id,
        name: signatureRecipes.name,
        creatorName: users.name,
        orderCount: signatureRecipes.orderCount,
        price30ml: signatureRecipes.price30ml,
      })
      .from(signatureRecipes)
      .innerJoin(users, eq(signatureRecipes.creatorId, users.id))
      .where(eq(signatureRecipes.status, "PUBLISHED" as RecipeStatus))
      .orderBy(desc(signatureRecipes.orderCount))
      .limit(limit);
    return recipes;
  }

  const preferredFlavorIds = prefs.map((p) => p.flavorId);

  const recipes = await db
    .select({
      id: signatureRecipes.id,
      name: signatureRecipes.name,
      creatorName: users.name,
      orderCount: signatureRecipes.orderCount,
      price30ml: signatureRecipes.price30ml,
      matchScore: sql<number>`COUNT(DISTINCT ${recipeFlavors.flavorId})`.as(
        "match_score",
      ),
    })
    .from(signatureRecipes)
    .innerJoin(users, eq(signatureRecipes.creatorId, users.id))
    .innerJoin(recipeFlavors, eq(signatureRecipes.id, recipeFlavors.recipeId))
    .where(
      and(
        eq(signatureRecipes.status, "PUBLISHED" as RecipeStatus),
        inArray(recipeFlavors.flavorId, preferredFlavorIds),
      ),
    )
    .groupBy(
      signatureRecipes.id,
      signatureRecipes.name,
      users.name,
      signatureRecipes.orderCount,
      signatureRecipes.price30ml,
    )
    .orderBy(desc(sql`match_score`), desc(signatureRecipes.orderCount))
    .limit(limit);

  return recipes;
}

/** Recommend creators based on user's blend history */
export async function getRecommendedCreators(userId: string, limit = 4) {
  const usedCreators = await db
    .select({
      creatorId: blendRequests.creatorId,
    })
    .from(blendRequests)
    .where(
      and(
        eq(blendRequests.userId, userId),
        sql`${blendRequests.creatorId} IS NOT NULL`,
      ),
    )
    .groupBy(blendRequests.creatorId);

  const usedCreatorIds = usedCreators
    .map((c) => c.creatorId)
    .filter((id): id is string => id !== null);

  const creators = await db
    .select({
      userId: creatorProfiles.userId,
      displayName: creatorProfiles.displayName,
      creatorIdSlug: creatorProfiles.creatorIdSlug,
      bio: creatorProfiles.bio,
      tier: creatorStats.tier,
      avgRating: creatorStats.avgRating,
    })
    .from(creatorProfiles)
    .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
    .where(
      and(
        eq(creatorProfiles.isActive, true),
        usedCreatorIds.length > 0
          ? sql`${creatorProfiles.userId} NOT IN (${sql.join(
              usedCreatorIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : sql`TRUE`,
      ),
    )
    .orderBy(desc(creatorStats.tierScore))
    .limit(limit);

  return creators;
}
