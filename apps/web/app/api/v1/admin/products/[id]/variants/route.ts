import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { createVariant } from "@/lib/services/product-service";
import { productVariants } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id));

  return apiSuccess({ variants });
});

const createVariantSchema = z.object({
  volume: z.number().int().positive(),
  price: z.number().int().min(0),
  sku: z.string().min(1).max(50),
  stock: z.number().int().min(0).default(0),
});

export const POST = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = createVariantSchema.parse(await req.json());
  const variantId = await createVariant(id, body);

  return apiSuccess({ variantId }, 201);
});
