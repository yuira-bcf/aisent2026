import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getMyApplication,
  submitCreatorApplication,
} from "@/lib/services/creator-profile-service";
import { creatorApplicationSchema } from "@/lib/validations/creator";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/application
 *
 * Get current user's creator application.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const application = await getMyApplication(authResult.userId);

  return apiSuccess({ application });
});

/**
 * POST /api/v1/creator/application
 *
 * Submit a new creator application. Only USER role can apply.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CUSTOMER"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = creatorApplicationSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const result = await submitCreatorApplication(authResult.userId, parsed.data);

  return apiSuccess(result, 201);
});
