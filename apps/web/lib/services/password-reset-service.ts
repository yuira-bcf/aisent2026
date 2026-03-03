import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import { passwordResetTokens, users } from "@kyarainnovate/db/schema";
import { hash } from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  // Always return success to prevent email enumeration
  if (!user) return;

  const token = randomUUID();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "パスワードリセット - KyaraInnovate",
    react: PasswordResetEmail({ resetUrl, userName: user.name }),
  });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = hashToken(token);

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  if (!record) return false;

  const passwordHash = await hash(newPassword, 12);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, record.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, record.id));

  return true;
}
