"use server";

import { auth } from "@/lib/auth";
import {
  saveRulesForKeyword,
  suggestRulesForKeyword as suggestService,
} from "@/lib/services/creator-service";
import type { NoteType } from "@kyarainnovate/db/schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const saveRulesSchema = z.object({
  keywordId: z.string().uuid(),
  rules: z
    .array(
      z.object({
        flavorId: z.string().uuid(),
        weight: z.number().min(0).max(1),
        noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
      }),
    )
    .min(1, "ルールを1つ以上追加してください"),
});

export type SaveRulesState = {
  error?: string;
  success?: boolean;
};

export async function saveRules(
  _prevState: SaveRulesState,
  formData: FormData,
): Promise<SaveRulesState> {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "CREATOR" && session.user.role !== "ADMIN")
  ) {
    return { error: "権限がありません" };
  }

  const raw = JSON.parse(formData.get("data") as string);
  const parsed = saveRulesSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { keywordId, rules } = parsed.data;

  await saveRulesForKeyword(keywordId, session.user.id, rules);

  revalidatePath("/keywords");
  revalidatePath(`/keywords/${keywordId}`);

  return { success: true };
}

export async function suggestRulesForKeyword(
  keywordId: string,
): Promise<{ flavorId: string; weight: number; noteType: NoteType }[]> {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "CREATOR" && session.user.role !== "ADMIN")
  ) {
    return [];
  }

  return suggestService(keywordId, session.user.id);
}
