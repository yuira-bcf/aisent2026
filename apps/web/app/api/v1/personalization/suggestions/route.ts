import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getFlavorPreferences } from "@/lib/services/personalization-service";
import { keywordFlavorRules, keywords } from "@kyarainnovate/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";

export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const prefs = await getFlavorPreferences(authResult.userId);

  if (prefs.length === 0) {
    return apiSuccess({ suggestions: [] });
  }

  const preferredFlavorIds = prefs.map((p) => p.flavorId);

  // Find keywords most associated with user's preferred flavors
  const keywordScores = await db
    .select({
      keywordId: keywordFlavorRules.keywordId,
      word: keywords.word,
      totalWeight:
        sql<number>`SUM(CAST(${keywordFlavorRules.weight} AS numeric))`.as(
          "total_weight",
        ),
      flavorCount:
        sql<number>`COUNT(DISTINCT ${keywordFlavorRules.flavorId})`.as(
          "flavor_count",
        ),
    })
    .from(keywordFlavorRules)
    .innerJoin(keywords, eq(keywordFlavorRules.keywordId, keywords.id))
    .where(inArray(keywordFlavorRules.flavorId, preferredFlavorIds))
    .groupBy(keywordFlavorRules.keywordId, keywords.word)
    .orderBy(desc(sql`total_weight`))
    .limit(8);

  // Build flavor name lookup for reasons
  const flavorNameMap = new Map(prefs.map((p) => [p.flavorId, p.nameJa]));

  const suggestions = await Promise.all(
    keywordScores.map(async (ks) => {
      // Find which preferred flavors this keyword maps to
      const matchedFlavors = await db
        .select({ flavorId: keywordFlavorRules.flavorId })
        .from(keywordFlavorRules)
        .where(
          sql`${keywordFlavorRules.keywordId} = ${ks.keywordId} AND ${keywordFlavorRules.flavorId} IN (${sql.join(
            preferredFlavorIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      const matchedNames = matchedFlavors
        .map((f) => flavorNameMap.get(f.flavorId))
        .filter(Boolean)
        .slice(0, 3);

      const suggestedWeight = Math.min(
        100,
        Math.max(10, Math.round(Number(ks.totalWeight) * 20)),
      );

      return {
        keyword: ks.word,
        suggestedWeight,
        reason: `好みの香料（${matchedNames.join("、")}）と相性が良いキーワードです`,
      };
    }),
  );

  return apiSuccess({ suggestions });
});
