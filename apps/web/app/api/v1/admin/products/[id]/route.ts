import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import {
  deleteProduct,
  getProductDetail,
  setProductTags,
  updateProduct,
} from "@/lib/services/product-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priceYen: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
  intensity: z.enum(["light", "medium", "strong"]).optional(),
  giftWrappingAvailable: z.boolean().optional(),
  isLimited: z.boolean().optional(),
  manufacturingDays: z.number().int().min(1).max(90).optional(),
  aiStory: z.string().optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.object({ type: z.string(), value: z.string() })).optional(),
});

/**
 * PUT /api/v1/admin/products/:id
 *
 * Admin only. Update a product with Zod validation.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const existing = await getProductDetail(id);
  if (!existing) return NOT_FOUND("商品が見つかりません");

  const body = updateSchema.parse(await req.json());
  const { tags, ...productFields } = body;

  if (Object.keys(productFields).length > 0) {
    await updateProduct(id, productFields);
  }

  if (tags) {
    await setProductTags(id, tags);
  }

  const updated = await getProductDetail(id);
  return apiSuccess({ product: updated });
});

/**
 * DELETE /api/v1/admin/products/:id
 *
 * Admin only. Soft-delete a product.
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const existing = await getProductDetail(id);
  if (!existing) return NOT_FOUND("商品が見つかりません");

  await deleteProduct(id);
  return apiSuccess({ deleted: true });
});
