import { db } from "@/lib/db";
import {
  blendRequestFlavors,
  blendResultFlavors,
  flavors,
  recipeFlavors,
} from "@kyarainnovate/db/schema";
import type { NoteType } from "@kyarainnovate/db/schema";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

export const createFlavorSchema = z.object({
  nameJa: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateFlavorInput = z.infer<typeof createFlavorSchema>;

export const updateFlavorSchema = createFlavorSchema.partial();
export type UpdateFlavorInput = z.infer<typeof updateFlavorSchema>;

export async function getAllFlavors() {
  return db
    .select()
    .from(flavors)
    .orderBy(asc(flavors.sortOrder), asc(flavors.nameJa));
}

export async function getFlavorById(id: string) {
  const [flavor] = await db.select().from(flavors).where(eq(flavors.id, id));
  return flavor ?? null;
}

export async function createFlavor(input: CreateFlavorInput) {
  const [flavor] = await db
    .insert(flavors)
    .values({
      nameJa: input.nameJa,
      nameEn: input.nameEn,
      noteType: input.noteType as NoteType,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return flavor;
}

export async function updateFlavor(id: string, input: UpdateFlavorInput) {
  const updates: Record<string, unknown> = {};
  if (input.nameJa !== undefined) updates.nameJa = input.nameJa;
  if (input.nameEn !== undefined) updates.nameEn = input.nameEn;
  if (input.noteType !== undefined) updates.noteType = input.noteType;
  if (input.description !== undefined) updates.description = input.description;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  const [flavor] = await db
    .update(flavors)
    .set(updates)
    .where(eq(flavors.id, id))
    .returning();
  return flavor ?? null;
}

export async function isFlavorReferenced(id: string): Promise<boolean> {
  const [[recipeRef], [blendReqRef], [blendResRef]] = await Promise.all([
    db
      .select({ value: count() })
      .from(recipeFlavors)
      .where(eq(recipeFlavors.flavorId, id)),
    db
      .select({ value: count() })
      .from(blendRequestFlavors)
      .where(eq(blendRequestFlavors.flavorId, id)),
    db
      .select({ value: count() })
      .from(blendResultFlavors)
      .where(eq(blendResultFlavors.flavorId, id)),
  ]);
  return recipeRef.value + blendReqRef.value + blendResRef.value > 0;
}

export async function deleteFlavor(id: string) {
  const result = await db
    .delete(flavors)
    .where(eq(flavors.id, id))
    .returning({ id: flavors.id });
  return result.length > 0;
}
