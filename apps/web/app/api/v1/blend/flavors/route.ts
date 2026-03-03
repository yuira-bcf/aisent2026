import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { flavors } from "@kyarainnovate/db/schema";
import { asc } from "drizzle-orm";

/**
 * GET /api/v1/blend/flavors
 *
 * Public endpoint — no auth required.
 * Returns all flavor master data.
 */
export const GET = safeHandler(async () => {
  const allFlavors = await db
    .select({
      id: flavors.id,
      nameJa: flavors.nameJa,
      nameEn: flavors.nameEn,
      noteType: flavors.noteType,
      description: flavors.description,
    })
    .from(flavors)
    .orderBy(asc(flavors.sortOrder));

  return apiSuccess({ flavors: allFlavors });
});
