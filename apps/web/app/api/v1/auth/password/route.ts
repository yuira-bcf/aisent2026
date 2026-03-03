import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { UNAUTHORIZED, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8, "パスワードは8文字以上にしてください")
    .max(128, "パスワードは128文字以内にしてください"),
});

export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return VALIDATION_ERROR(parsed.error.errors[0].message);

  const user = await db.query.users.findFirst({
    where: eq(users.id, authResult.userId),
  });
  if (!user) return UNAUTHORIZED();

  const isValid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) return VALIDATION_ERROR("現在のパスワードが正しくありません");

  const newHash = await hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, authResult.userId));

  return apiSuccess({ message: "パスワードを変更しました" });
});
