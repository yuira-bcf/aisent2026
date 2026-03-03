import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { shippingAddresses } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateAddressSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  recipientName: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(1).max(10).optional(),
  prefecture: z.string().min(1).max(20).optional(),
  city: z.string().min(1).max(100).optional(),
  addressLine1: z.string().min(1).max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  phone: z.string().min(1).max(20).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * PATCH /api/v1/shipping-addresses/:id
 *
 * Update a shipping address (owner only).
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const { userId } = authResult;

  const body = await req.json();
  const parsed = updateAddressSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  // If setting as default, unset other defaults first
  if (parsed.data.isDefault) {
    await db
      .update(shippingAddresses)
      .set({ isDefault: false })
      .where(
        and(
          eq(shippingAddresses.userId, userId),
          eq(shippingAddresses.isDefault, true),
        ),
      );
  }

  const [updated] = await db
    .update(shippingAddresses)
    .set(parsed.data)
    .where(
      and(eq(shippingAddresses.id, id), eq(shippingAddresses.userId, userId)),
    )
    .returning();

  if (!updated) return NOT_FOUND("配送先が見つかりません");

  return apiSuccess({ address: updated });
});

/**
 * DELETE /api/v1/shipping-addresses/:id
 *
 * Delete a shipping address (owner only).
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const { userId } = authResult;

  const [deleted] = await db
    .delete(shippingAddresses)
    .where(
      and(eq(shippingAddresses.id, id), eq(shippingAddresses.userId, userId)),
    )
    .returning({ id: shippingAddresses.id });

  if (!deleted) return NOT_FOUND("配送先が見つかりません");

  return apiSuccess({ deleted: true });
});
