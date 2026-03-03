import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/v1/auth/me
 *
 * Get authenticated user's profile.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const user = await db.query.users.findFirst({
    where: eq(users.id, authResult.userId),
    columns: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return apiSuccess({ user });
});

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * PATCH /api/v1/auth/me
 *
 * Update authenticated user's profile.
 */
export const PATCH = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updates: Record<string, string> = {};
  if (parsed.data.name) updates.name = parsed.data.name;

  if (Object.keys(updates).length === 0) {
    return VALIDATION_ERROR("更新するフィールドを指定してください");
  }

  await db.update(users).set(updates).where(eq(users.id, authResult.userId));

  const user = await db.query.users.findFirst({
    where: eq(users.id, authResult.userId),
    columns: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return apiSuccess({ user });
});
