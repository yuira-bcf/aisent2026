import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const tasteSchema = z.object({
  category: z.string().min(1),
  axes: z.record(z.string(), z.number().min(-50).max(50)),
});

/**
 * POST /api/v1/auth/taste-preferences
 *
 * Save user's taste preferences.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = tasteSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  await db
    .update(users)
    .set({ tastePreferences: parsed.data })
    .where(eq(users.id, authResult.userId));

  return apiSuccess({ saved: true });
});
