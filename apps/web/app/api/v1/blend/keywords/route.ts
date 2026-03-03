import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { keywords } from "@kyarainnovate/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/blend/keywords
 *
 * Public endpoint — no auth required.
 * Returns keyword master data.
 * Query params:
 *   - preset=true : only preset keywords
 *   - category=SEASON|PLACE|MOOD|FREE : filter by category
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const presetOnly = url.searchParams.get("preset") === "true";
  const category = url.searchParams.get("category");

  let query = db
    .select({
      id: keywords.id,
      word: keywords.word,
      category: keywords.category,
      isPreset: keywords.isPreset,
      usageCount: keywords.usageCount,
    })
    .from(keywords)
    .$dynamic();

  if (presetOnly) {
    query = query.where(eq(keywords.isPreset, true));
  }

  if (category) {
    query = query.where(
      eq(keywords.category, category as "SEASON" | "PLACE" | "MOOD" | "FREE"),
    );
  }

  const allKeywords = await query.orderBy(
    desc(keywords.usageCount),
    asc(keywords.word),
  );

  return apiSuccess({ keywords: allKeywords });
});
