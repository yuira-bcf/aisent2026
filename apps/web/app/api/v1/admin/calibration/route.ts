import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { aiCalibrationParams } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/calibration
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const params = await db.select().from(aiCalibrationParams);

  return apiSuccess({ params });
});

/**
 * PUT /api/v1/admin/calibration
 *
 * Body: { params: Array<{ paramName, paramValue, description?, category }> }
 * Upserts all provided parameters.
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();

  if (!Array.isArray(body.params)) {
    return VALIDATION_ERROR("params は配列で指定してください");
  }

  const results = [];
  for (const p of body.params) {
    if (!p.paramName || !p.category) continue;

    const existing = await db
      .select()
      .from(aiCalibrationParams)
      .where(eq(aiCalibrationParams.paramName, p.paramName))
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(aiCalibrationParams)
        .set({
          paramValue: String(p.paramValue),
          description: p.description ?? existing[0].description,
          category: p.category,
          updatedAt: new Date(),
        })
        .where(eq(aiCalibrationParams.id, existing[0].id))
        .returning();
      results.push(updated[0]);
    } else {
      const inserted = await db
        .insert(aiCalibrationParams)
        .values({
          paramName: p.paramName,
          paramValue: String(p.paramValue),
          description: p.description || null,
          category: p.category,
        })
        .returning();
      results.push(inserted[0]);
    }
  }

  return apiSuccess({ params: results });
});
