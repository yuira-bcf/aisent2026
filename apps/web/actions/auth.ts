"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("正しいメールアドレスを入力してください"),
  password: z
    .string()
    .min(6, "パスワードは6文字以上で入力してください")
    .max(128, "パスワードは128文字以内にしてください"),
  name: z.string().min(1, "名前を入力してください"),
});

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password, name } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await hash(password, 12);

  await db.insert(users).values({
    email,
    passwordHash,
    name,
    role: "CUSTOMER",
  });

  await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  redirect("/");
}
