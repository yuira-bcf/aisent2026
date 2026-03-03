import { safeHandler } from "@/lib/api/handler";
import {
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  rateLimitKey,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limiter";
import { VALIDATION_ERROR, apiError, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上にしてください")
    .max(128, "パスワードは128文字以内にしてください"),
  name: z.string().min(1, "名前を入力してください").max(100),
});

/**
 * POST /api/v1/auth/register
 *
 * Create a new user account (no auth required).
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
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const { email, password, name } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return apiError(
      "CONFLICT",
      "このメールアドレスは既に登録されています",
      409,
    );
  }

  const passwordHash = await hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, role: "CUSTOMER" })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });

  return apiSuccess({ user }, 201);
});
