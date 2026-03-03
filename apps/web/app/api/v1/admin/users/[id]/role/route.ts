import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { updateUserRole } from "@/lib/services/admin-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["CUSTOMER", "CREATOR", "ADMIN"]),
});

/**
 * PATCH /api/v1/admin/users/:id/role
 *
 * Admin only. Change a user's role.
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateUserRole(id, parsed.data.role);

  if (!updated) return NOT_FOUND("ユーザーが見つかりません");

  return apiSuccess({ updated: true });
});
