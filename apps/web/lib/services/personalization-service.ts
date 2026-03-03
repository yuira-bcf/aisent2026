import { db } from "@/lib/db";
import {
  blendRequests,
  blendResultFlavors,
  blendResults,
  creatorProfiles,
  creatorStats,
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

/** Analyze user's blend history to find preferred flavors */
export async function getFlavorPreferences(
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
