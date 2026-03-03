import { auditLoginFailure, auditLoginSuccess } from "@/lib/api/audit-logger";
import { safeHandler } from "@/lib/api/handler";
import {
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  rateLimitKey,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limiter";
import { UNAUTHORIZED, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

/**
 * POST /api/v1/auth/login
 *
 * Authenticate and return user info.
 * Note: This returns user data for API clients. Web clients use Auth.js signIn().
 */
export const POST = safeHandler(async (req: NextRequest) => {
  // Rate limit check
  const ip = getClientIp(req);
  const rlResult = await rateLimit(
    rateLimitKey("AUTH", ip),
    RATE_LIMITS.AUTH.limit,
    RATE_LIMITS.AUTH.windowSeconds,
  );
  if (!rlResult.allowed) {
    return tooManyRequestsResponse(rlResult, RATE_LIMITS.AUTH.limit);
  }

  const body = await req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    await auditLoginFailure(email, req);
    return UNAUTHORIZED("メールアドレスまたはパスワードが正しくありません");
  }

  const isValid = await compare(password, user.passwordHash);
  if (!isValid) {
    await auditLoginFailure(email, req);
    return UNAUTHORIZED("メールアドレスまたはパスワードが正しくありません");
  }

  await auditLoginSuccess(user.id, req);

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});
