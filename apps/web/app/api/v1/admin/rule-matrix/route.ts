import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  flavors,
  keywordFlavorRules,
  keywords,
} from "@kyarainnovate/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/rule-matrix
 *
 * Returns keywords, flavors, and base rules (creatorId IS NULL) for matrix view.
 * Query params: ?keywordCategory=SEASON (optional filter)
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const url = new URL(req.url);
  const keywordCategory = url.searchParams.get("keywordCategory");

  // Get keywords (optionally filtered by category)
  const keywordWhere =
    keywordCategory && keywordCategory !== "ALL"
      ? eq(
          keywords.category,
          keywordCategory as "SEASON" | "PLACE" | "MOOD" | "FREE",
        )
      : undefined;
  const allKeywords = await db
    .select()
    .from(keywords)
    .where(keywordWhere)
    .orderBy(asc(keywords.word));

  // Get flavors
  const allFlavors = await db
    .select()
    .from(flavors)
    .orderBy(asc(flavors.sortOrder));

  // Get base rules (creatorId IS NULL)
  const baseRules = await db
    .select()
    .from(keywordFlavorRules)
    .where(isNull(keywordFlavorRules.creatorId));

  return apiSuccess({
    keywords: allKeywords,
    flavors: allFlavors,
    rules: baseRules,
  });
});

/**
 * PUT /api/v1/admin/rule-matrix
 *
 * Upsert a base rule. Body: { keywordId, flavorId, noteType, weight }
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();

  if (!body.keywordId || !body.flavorId || !body.noteType) {
    return VALIDATION_ERROR("keywordId, flavorId, noteType は必須です");
  }

  const weight = Number(body.weight);
  if (Number.isNaN(weight) || weight < 0 || weight > 10) {
    return VALIDATION_ERROR("weightは0〜10の範囲で指定してください");
  }

  // Find existing base rule
  const existing = await db
    .select()
    .from(keywordFlavorRules)
    .where(
      and(
        eq(keywordFlavorRules.keywordId, body.keywordId),
        eq(keywordFlavorRules.flavorId, body.flavorId),
        isNull(keywordFlavorRules.creatorId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    if (weight === 0) {
      // Delete rule if weight is 0
      await db
        .delete(keywordFlavorRules)
        .where(eq(keywordFlavorRules.id, existing[0].id));
      return apiSuccess({ deleted: true });
    }
    const updated = await db
      .update(keywordFlavorRules)
      .set({ weight: String(weight), noteType: body.noteType })
      .where(eq(keywordFlavorRules.id, existing[0].id))
      .returning();
    return apiSuccess({ rule: updated[0] });
  }
  if (weight === 0) {
    return apiSuccess({ skipped: true });
  }
  const inserted = await db
    .insert(keywordFlavorRules)
    .values({
      keywordId: body.keywordId,
      flavorId: body.flavorId,
      noteType: body.noteType,
      weight: String(weight),
      creatorId: null,
    })
    .returning();
  return apiSuccess({ rule: inserted[0] }, 201);
});
