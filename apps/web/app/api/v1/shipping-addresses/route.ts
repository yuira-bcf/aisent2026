import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { shippingAddresses } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/v1/shipping-addresses
 *
 * List shipping addresses for the authenticated user.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const addresses = await db
    .select()
    .from(shippingAddresses)
    .where(eq(shippingAddresses.userId, authResult.userId));

  return apiSuccess({ addresses });
});

const createAddressSchema = z.object({
  label: z.string().min(1).max(50),
  recipientName: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(10),
  prefecture: z.string().min(1).max(20),
  city: z.string().min(1).max(100),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  phone: z.string().min(1).max(20),
  isDefault: z.boolean().optional().default(false),
});

/**
 * POST /api/v1/shipping-addresses
 *
 * Add a new shipping address.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createAddressSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const { userId } = authResult;

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

  const [address] = await db
    .insert(shippingAddresses)
    .values({
      userId,
      ...parsed.data,
    })
    .returning();

  return apiSuccess({ address }, 201);
});
