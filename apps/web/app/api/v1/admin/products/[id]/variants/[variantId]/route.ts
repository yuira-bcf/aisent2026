import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { deleteVariant, updateVariant } from "@/lib/services/product-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateVariantSchema = z.object({
  volume: z.number().int().positive().optional(),
  price: z.number().int().min(0).optional(),
  sku: z.string().min(1).max(50).optional(),
  stock: z.number().int().min(0).optional(),
});

export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { variantId } = await ctx.params;
  const body = updateVariantSchema.parse(await req.json());
  await updateVariant(variantId, body);
  return apiSuccess({ updated: true });
});

export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { variantId } = await ctx.params;
  await deleteVariant(variantId);
  return apiSuccess({ deleted: true });
});
