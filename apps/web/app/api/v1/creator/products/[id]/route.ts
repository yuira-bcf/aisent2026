import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { FORBIDDEN, NOT_FOUND, apiSuccess } from "@/lib/api/response";
import {
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
  tags: z
    .array(
      z.object({
        type: z.enum(["season", "scene", "feature"]),
        value: z.string().min(1).max(50),
      }),
    )
    .max(20)
    .optional(),
});

export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const product = await getProductDetail(id);
  if (!product) return NOT_FOUND("商品が見つかりません");

  // Creator can only see own products
  if (
    authResult.role === "CREATOR" &&
    product.creatorId !== authResult.userId
  ) {
    return FORBIDDEN("自分の商品のみ閲覧できます");
  }

  return apiSuccess({ product });
});

export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const product = await getProductDetail(id);
  if (!product) return NOT_FOUND("商品が見つかりません");

  if (
    authResult.role === "CREATOR" &&
    product.creatorId !== authResult.userId
  ) {
    return FORBIDDEN("自分の商品のみ編集できます");
  }

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
