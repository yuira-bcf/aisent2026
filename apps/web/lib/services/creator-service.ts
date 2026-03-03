import { suggestRules as suggestRulesAI } from "@/lib/ai-client";
import { db } from "@/lib/db";
import {
  flavors,
  keywordFlavorRules,
  keywords,
} from "@kyarainnovate/db/schema";
import type { NoteType } from "@kyarainnovate/db/schema";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";

/**
 * Get all keywords with the number of rules this creator has defined for each.
 * Ordered by usageCount descending.
 */
export async function getKeywordsWithRuleCounts(creatorId: string) {
  return db
    .select({
      id: keywords.id,
      word: keywords.word,
      category: keywords.category,
      isPreset: keywords.isPreset,
      usageCount: keywords.usageCount,
      ruleCount: sql<number>`(
        SELECT COUNT(*) FROM keyword_flavor_rules
        WHERE keyword_flavor_rules.keyword_id = ${keywords.id}
          AND keyword_flavor_rules.creator_id = ${creatorId}
      )`.as("rule_count"),
    })
    .from(keywords)
    .orderBy(sql`${keywords.usageCount} DESC`);
}

/**
 * Get all rules this creator has defined for a specific keyword.
 */
export async function getRulesForKeyword(keywordId: string, creatorId: string) {
  return db
    .select({
      id: keywordFlavorRules.id,
      flavorId: keywordFlavorRules.flavorId,
      weight: keywordFlavorRules.weight,
      noteType: keywordFlavorRules.noteType,
    })
    .from(keywordFlavorRules)
    .where(
      and(
        eq(keywordFlavorRules.keywordId, keywordId),
        eq(keywordFlavorRules.creatorId, creatorId),
      ),
    );
}

/**
 * Delete existing rules and insert new ones for a keyword by a creator.
 */
export async function saveRulesForKeyword(
  keywordId: string,
  creatorId: string,
  rules: { flavorId: string; weight: number; noteType: NoteType }[],
) {
  await db
    .delete(keywordFlavorRules)
    .where(
      and(
        eq(keywordFlavorRules.keywordId, keywordId),
        eq(keywordFlavorRules.creatorId, creatorId),
      ),
    );

  await db.insert(keywordFlavorRules).values(
    rules.map((rule) => ({
      keywordId,
      flavorId: rule.flavorId,
      weight: rule.weight.toFixed(4),
      noteType: rule.noteType as NoteType,
      creatorId,
    })),
  );
}

/**
 * Suggest rules for a keyword using AI.
 * Returns an empty array if the keyword is not found.
 */
export async function suggestRulesForKeyword(
  keywordId: string,
  creatorId: string,
): Promise<{ flavorId: string; weight: number; noteType: NoteType }[]> {
  const keyword = await db.query.keywords.findFirst({
    where: eq(keywords.id, keywordId),
  });

  if (!keyword) return [];

  const allFlavors = await db.select().from(flavors);

  return suggestRulesAI(
    keyword.word,
    allFlavors.map((f) => ({
      id: f.id,
      nameEn: f.nameEn,
      noteType: f.noteType,
    })),
  );
}

/**
 * Get creator stats: total keywords, keywords with rules, total rules, coverage percent.
 */
export async function getCreatorStats(creatorId: string) {
  const [{ total: totalKeywords }] = await db
    .select({ total: count() })
    .from(keywords);

  const [{ total: keywordsWithRules }] = await db
    .select({ total: countDistinct(keywordFlavorRules.keywordId) })
    .from(keywordFlavorRules)
    .where(eq(keywordFlavorRules.creatorId, creatorId));

  const [{ total: totalRules }] = await db
    .select({ total: count() })
    .from(keywordFlavorRules)
    .where(eq(keywordFlavorRules.creatorId, creatorId));

  const coveragePercent =
    totalKeywords > 0 ? (keywordsWithRules / totalKeywords) * 100 : 0;

  return { totalKeywords, keywordsWithRules, totalRules, coveragePercent };
}

/**
 * Get all flavors ordered by sortOrder.
 */
export async function getAllFlavors() {
  return db
    .select({
      id: flavors.id,
      nameJa: flavors.nameJa,
      nameEn: flavors.nameEn,
      noteType: flavors.noteType,
      description: flavors.description,
    })
    .from(flavors)
    .orderBy(flavors.sortOrder);
}
