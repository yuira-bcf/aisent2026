import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { createProduct } from "@/lib/services/product-service";
import { products } from "@kyarainnovate/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

// GET: List creator's own products
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const items = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.creatorId, authResult.userId),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(desc(products.createdAt));

  return apiSuccess({ products: items });
});

// POST: Create a product (publish)
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priceYen: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  recipeId: z.string().uuid().optional(),
  intensity: z.enum(["light", "medium", "strong"]).optional(),
  giftWrappingAvailable: z.boolean().optional(),
  isLimited: z.boolean().optional(),
  manufacturingDays: z.number().int().min(1).max(90).optional(),
  variants: z
    .array(
      z.object({
        volume: z.number().int().positive(),
        price: z.number().int().min(0),
        sku: z.string().min(1).max(50),
        stock: z.number().int().min(0).default(0),
      }),
    )
    .optional(),
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

export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = createProductSchema.parse(await req.json());
  const productId = await createProduct({
    ...body,
    creatorId: authResult.userId,
  });

  return apiSuccess({ productId }, 201);
});
