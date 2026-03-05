import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  addProductImage,
  deleteProductImage,
} from "@/lib/services/product-service";
import { productImages } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(productImages.sortOrder);

  return apiSuccess({ images });
});

const addImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200).optional(),
});

export const POST = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const { url, alt } = addImageSchema.parse(await req.json());
  const imageId = await addProductImage(id, url, alt);
  return apiSuccess({ imageId }, 201);
});

const deleteImageSchema = z.object({
  imageId: z.string().uuid(),
});

export const DELETE = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { imageId } = deleteImageSchema.parse(await req.json());
  await deleteProductImage(imageId);
  return apiSuccess({ deleted: true });
});
