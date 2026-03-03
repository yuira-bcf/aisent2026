import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  createFlavor,
  createFlavorSchema,
  getAllFlavors,
} from "@/lib/services/flavor-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/flavors
 *
 * Admin only. List all flavors.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const flavors = await getAllFlavors();
  return apiSuccess({ flavors });
});

/**
 * POST /api/v1/admin/flavors
 *
 * Admin only. Create a new flavor.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createFlavorSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  const flavor = await createFlavor(parsed.data);
  return apiSuccess({ flavor }, 201);
});
