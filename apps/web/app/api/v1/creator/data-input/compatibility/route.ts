import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { flavorCompatibility, flavors } from "@kyarainnovate/db/schema";
import { and, eq, exists, not, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  flavorAId: z.string().uuid(),
  flavorBId: z.string().uuid(),
  score: z.number().min(-1).max(1),
});

/**
 * GET /api/v1/creator/data-input/compatibility
 * Returns next unevaluated pair of flavors, or random pair.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  // mode=stats: return today's count and total
  if (mode === "stats") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(flavorCompatibility)
      .where(eq(flavorCompatibility.creatorId, authResult.userId));

    const [todayCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(flavorCompatibility)
      .where(
        and(
          eq(flavorCompatibility.creatorId, authResult.userId),
          sql`${flavorCompatibility.createdAt} >= ${today}`,
        ),
      );

    return apiSuccess({ total: total.count, today: todayCount.count });
  }

  // Get all flavors
  const allFlavors = await db
    .select({
      id: flavors.id,
      nameJa: flavors.nameJa,
      nameEn: flavors.nameEn,
      noteType: flavors.noteType,
    })
    .from(flavors)
    .orderBy(flavors.sortOrder);

  if (allFlavors.length < 2) {
    return apiSuccess({ pair: null, message: "香料が不足しています" });
  }

  // Try to find an unevaluated pair
  // Simple approach: pick two random flavors that haven't been scored yet
  const evaluated = await db
    .select({
      flavorAId: flavorCompatibility.flavorAId,
      flavorBId: flavorCompatibility.flavorBId,
    })
    .from(flavorCompatibility)
    .where(eq(flavorCompatibility.creatorId, authResult.userId));

  const evaluatedSet = new Set(
    evaluated.map((e) => `${e.flavorAId}:${e.flavorBId}`),
  );

  // Find unevaluated pair
  let pairFound = false;
  let flavorA = allFlavors[0];
  let flavorB = allFlavors[1];

  for (let attempt = 0; attempt < 50; attempt++) {
    const idxA = Math.floor(Math.random() * allFlavors.length);
    let idxB = Math.floor(Math.random() * allFlavors.length);
    if (idxB === idxA) idxB = (idxA + 1) % allFlavors.length;

    const a = allFlavors[idxA];
    const b = allFlavors[idxB];
    const key1 = `${a.id}:${b.id}`;
    const key2 = `${b.id}:${a.id}`;

    if (!evaluatedSet.has(key1) && !evaluatedSet.has(key2)) {
      flavorA = a;
      flavorB = b;
      pairFound = true;
      break;
    }
  }

  if (!pairFound) {
    // All pairs evaluated or couldn't find one in 50 tries
    const idxA = Math.floor(Math.random() * allFlavors.length);
    let idxB = Math.floor(Math.random() * allFlavors.length);
    if (idxB === idxA) idxB = (idxA + 1) % allFlavors.length;
    flavorA = allFlavors[idxA];
    flavorB = allFlavors[idxB];
  }

  return apiSuccess({
    pair: { flavorA, flavorB },
    allEvaluated: !pairFound,
  });
});

export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  if (parsed.data.flavorAId === parsed.data.flavorBId) {
    return VALIDATION_ERROR("同じ香料を選択できません");
  }

  // Upsert
  const existing = await db
    .select({ id: flavorCompatibility.id })
    .from(flavorCompatibility)
    .where(
      and(
        eq(flavorCompatibility.creatorId, authResult.userId),
        eq(flavorCompatibility.flavorAId, parsed.data.flavorAId),
        eq(flavorCompatibility.flavorBId, parsed.data.flavorBId),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(flavorCompatibility)
      .set({ score: String(parsed.data.score) })
      .where(eq(flavorCompatibility.id, existing[0].id));
    return apiSuccess({ id: existing[0].id });
  }

  const [row] = await db
    .insert(flavorCompatibility)
    .values({
      creatorId: authResult.userId,
      flavorAId: parsed.data.flavorAId,
      flavorBId: parsed.data.flavorBId,
      score: String(parsed.data.score),
    })
    .returning({ id: flavorCompatibility.id });

  return apiSuccess({ id: row.id }, 201);
});
