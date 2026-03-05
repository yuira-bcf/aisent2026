import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { clearSalePrice, setSalePrice } from "@/lib/services/product-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const setSaleSchema = z.object({
  variantId: z.string().uuid(),
  salePrice: z.number().int().min(0),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = setSaleSchema.parse(await req.json());
  await setSalePrice(
    body.variantId,
    body.salePrice,
    new Date(body.startAt),
    new Date(body.endAt),
  );
  return apiSuccess({ updated: true });
});

const clearSaleSchema = z.object({
  variantId: z.string().uuid(),
});

export const DELETE = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { variantId } = clearSaleSchema.parse(await req.json());
  await clearSalePrice(variantId);
  return apiSuccess({ cleared: true });
});
