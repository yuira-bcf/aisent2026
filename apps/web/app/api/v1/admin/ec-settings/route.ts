import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { ecSettings } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const DEFAULTS = {
  shippingFeeYen: 0,
  taxRate: "10.0",
  freeShippingThresholdYen: 5000,
  paymentProvider: "stripe",
};

/**
 * GET /api/v1/admin/ec-settings
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const rows = await db.select().from(ecSettings).limit(1);
  const settings = rows[0] ?? DEFAULTS;

  return apiSuccess({ settings });
});

/**
 * PUT /api/v1/admin/ec-settings
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();

  if (
    body.shippingFeeYen != null &&
    (typeof body.shippingFeeYen !== "number" || body.shippingFeeYen < 0)
  ) {
    return VALIDATION_ERROR("送料は0以上の数値を指定してください");
  }
  if (
    body.taxRate != null &&
    (Number.isNaN(Number(body.taxRate)) || Number(body.taxRate) < 0)
  ) {
    return VALIDATION_ERROR("税率は0以上の数値を指定してください");
  }
  if (
    body.freeShippingThresholdYen != null &&
    (typeof body.freeShippingThresholdYen !== "number" ||
      body.freeShippingThresholdYen < 0)
  ) {
    return VALIDATION_ERROR("送料無料しきい値は0以上の数値を指定してください");
  }

  const rows = await db.select().from(ecSettings).limit(1);

  if (rows[0]) {
    const updated = await db
      .update(ecSettings)
      .set({
        shippingFeeYen: body.shippingFeeYen ?? rows[0].shippingFeeYen,
        taxRate: body.taxRate != null ? String(body.taxRate) : rows[0].taxRate,
        freeShippingThresholdYen:
          body.freeShippingThresholdYen ?? rows[0].freeShippingThresholdYen,
        paymentProvider: body.paymentProvider ?? rows[0].paymentProvider,
        updatedAt: new Date(),
      })
      .where(eq(ecSettings.id, rows[0].id))
      .returning();
    return apiSuccess({ settings: updated[0] });
  }
  const inserted = await db
    .insert(ecSettings)
    .values({
      shippingFeeYen: body.shippingFeeYen ?? DEFAULTS.shippingFeeYen,
      taxRate: body.taxRate != null ? String(body.taxRate) : DEFAULTS.taxRate,
      freeShippingThresholdYen:
        body.freeShippingThresholdYen ?? DEFAULTS.freeShippingThresholdYen,
      paymentProvider: body.paymentProvider ?? DEFAULTS.paymentProvider,
    })
    .returning();
  return apiSuccess({ settings: inserted[0] });
});
