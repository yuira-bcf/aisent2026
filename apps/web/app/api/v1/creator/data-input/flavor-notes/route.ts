import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { creatorFlavorNotes, flavors } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  flavorId: z.string().uuid(),
  volatility: z.number().min(0).max(100),
  intensity: z.number().min(0).max(100),
  weight: z.enum(["light", "medium", "heavy"]),
  temperature: z.enum(["cool", "neutral", "warm"]),
  memo: z.string().optional(),
});

export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const notes = await db
    .select({
      id: creatorFlavorNotes.id,
      flavorId: creatorFlavorNotes.flavorId,
      flavorNameJa: flavors.nameJa,
      flavorNameEn: flavors.nameEn,
      flavorNoteType: flavors.noteType,
      volatility: creatorFlavorNotes.volatility,
      intensity: creatorFlavorNotes.intensity,
      weight: creatorFlavorNotes.weight,
      temperature: creatorFlavorNotes.temperature,
      memo: creatorFlavorNotes.memo,
      createdAt: creatorFlavorNotes.createdAt,
    })
    .from(creatorFlavorNotes)
    .innerJoin(flavors, eq(creatorFlavorNotes.flavorId, flavors.id))
    .where(eq(creatorFlavorNotes.creatorId, authResult.userId))
    .orderBy(creatorFlavorNotes.createdAt);

  return apiSuccess({ items: notes, total: notes.length });
});

export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  const existing = await db
    .select({ id: creatorFlavorNotes.id })
    .from(creatorFlavorNotes)
    .where(
      and(
        eq(creatorFlavorNotes.creatorId, authResult.userId),
        eq(creatorFlavorNotes.flavorId, parsed.data.flavorId),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(creatorFlavorNotes)
      .set({
        volatility: String(parsed.data.volatility),
        intensity: String(parsed.data.intensity),
        weight: parsed.data.weight,
        temperature: parsed.data.temperature,
        memo: parsed.data.memo ?? null,
      })
      .where(eq(creatorFlavorNotes.id, existing[0].id));

    return apiSuccess({ id: existing[0].id });
  }

  const [row] = await db
    .insert(creatorFlavorNotes)
    .values({
      creatorId: authResult.userId,
      flavorId: parsed.data.flavorId,
      volatility: String(parsed.data.volatility),
      intensity: String(parsed.data.intensity),
      weight: parsed.data.weight,
      temperature: parsed.data.temperature,
      memo: parsed.data.memo ?? null,
    })
    .returning({ id: creatorFlavorNotes.id });

  return apiSuccess({ id: row.id }, 201);
});
