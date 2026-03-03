import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { flavors, prohibitedCombinations } from "@kyarainnovate/db/schema";
import { and, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  flavorAId: z.string().uuid(),
  flavorBId: z.string().uuid(),
  reason: z.enum(["chemical_reaction", "odor_clash", "safety", "aesthetic"]),
  notes: z.string().optional(),
});

export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const flavorsA = db
    .$with("flavors_a")
    .as(db.select({ id: flavors.id, nameJa: flavors.nameJa }).from(flavors));
  const flavorsB = db
    .$with("flavors_b")
    .as(db.select({ id: flavors.id, nameJa: flavors.nameJa }).from(flavors));

  const items = await db
    .with(flavorsA, flavorsB)
    .select({
      id: prohibitedCombinations.id,
      flavorAId: prohibitedCombinations.flavorAId,
      flavorAName: flavorsA.nameJa,
      flavorBId: prohibitedCombinations.flavorBId,
      flavorBName: flavorsB.nameJa,
      reason: prohibitedCombinations.reason,
      notes: prohibitedCombinations.notes,
      createdAt: prohibitedCombinations.createdAt,
    })
    .from(prohibitedCombinations)
    .innerJoin(flavorsA, eq(prohibitedCombinations.flavorAId, flavorsA.id))
    .innerJoin(flavorsB, eq(prohibitedCombinations.flavorBId, flavorsB.id))
    .where(eq(prohibitedCombinations.creatorId, authResult.userId))
    .orderBy(prohibitedCombinations.createdAt);

  return apiSuccess({ items, total: items.length });
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

  const existing = await db
    .select({ id: prohibitedCombinations.id })
    .from(prohibitedCombinations)
    .where(
      and(
        eq(prohibitedCombinations.creatorId, authResult.userId),
        or(
          and(
            eq(prohibitedCombinations.flavorAId, parsed.data.flavorAId),
            eq(prohibitedCombinations.flavorBId, parsed.data.flavorBId),
          ),
          and(
            eq(prohibitedCombinations.flavorAId, parsed.data.flavorBId),
            eq(prohibitedCombinations.flavorBId, parsed.data.flavorAId),
          ),
        ),
      ),
    );

  if (existing.length > 0) {
    return VALIDATION_ERROR("この組み合わせは既に登録されています");
  }

  const [row] = await db
    .insert(prohibitedCombinations)
    .values({
      creatorId: authResult.userId,
      flavorAId: parsed.data.flavorAId,
      flavorBId: parsed.data.flavorBId,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: prohibitedCombinations.id });

  return apiSuccess({ id: row.id }, 201);
});

export const DELETE = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return VALIDATION_ERROR("idが必要です");

  const deleted = await db
    .delete(prohibitedCombinations)
    .where(
      and(
        eq(prohibitedCombinations.id, id),
        eq(prohibitedCombinations.creatorId, authResult.userId),
      ),
    )
    .returning({ id: prohibitedCombinations.id });

  if (deleted.length === 0) return NOT_FOUND();

  return apiSuccess({ deleted: true });
});
