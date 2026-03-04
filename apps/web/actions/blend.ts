"use server";

import { auth } from "@/lib/auth";
import {
  applyRefinement,
  parseNaturalLanguage,
} from "@/lib/blend/parse-natural-language";
import {
  blendInputSchema,
  executeBlend,
  executeRecipeBlend,
  getBlendResultDetail,
  updateBlendName as updateBlendNameService,
} from "@/lib/services/blend-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type BlendState = {
  error?: string;
};

export async function createBlend(
  _prevState: BlendState,
  formData: FormData,
): Promise<BlendState> {
  const session = await auth();
  if (!session) redirect("/login");

  const raw = JSON.parse(formData.get("data") as string);
  const { creatorId, mode, ...blendData } = raw;
  const parsed = blendInputSchema.safeParse(blendData);

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  if (mode === "styled" && !creatorId) {
    return { error: "クリエイターを選択してください" };
  }

  const result = await executeBlend({
    userId: session.user.id,
    ...parsed.data,
    creatorId: typeof creatorId === "string" ? creatorId : undefined,
  });

  redirect(`/result/${result.blendRequestId}`);
}

export async function createRecipeBlend(
  _prevState: BlendState,
  formData: FormData,
): Promise<BlendState> {
  const session = await auth();
  if (!session) redirect("/login");

  const raw = JSON.parse(formData.get("data") as string);
  const recipeId = raw.recipeId as string;
  if (!recipeId) return { error: "レシピを選択してください" };

  const result = await executeRecipeBlend({
    userId: session.user.id,
    recipeId,
  });

  redirect(`/result/${result.blendRequestId}`);
}

const updateNameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export async function updateBlendName(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const parsed = updateNameSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });

  if (!parsed.success) return;

  const { id, name } = parsed.data;

  await updateBlendNameService(id, session.user.id, name);

  revalidatePath(`/result/${id}`);
}

// ---------------------------------------------------------------------------
// createChatBlend – Chat-based natural language blend
// ---------------------------------------------------------------------------

export async function createChatBlend(
  _prevState: BlendState,
  formData: FormData,
): Promise<BlendState> {
  const session = await auth();
  if (!session) redirect("/login");

  const text = (formData.get("text") as string)?.trim();
  if (!text) {
    return { error: "テキストを入力してください" };
  }

  const creatorId = (formData.get("creatorId") as string) || undefined;

  const extracted = parseNaturalLanguage(text);
  if (extracted.length === 0) {
    return {
      error: "キーワードを抽出できませんでした。別の表現をお試しください",
    };
  }

  const keywords = extracted.map((k) => ({ word: k.word, weight: k.weight }));

  const result = await executeBlend({
    userId: session.user.id,
    keywords,
    topRatio: 35,
    middleRatio: 55,
    lastRatio: 10,
    creatorId,
  });

  redirect(`/result/${result.blendRequestId}`);
}

// ---------------------------------------------------------------------------
// refineBlend – Refinement of an existing blend
// ---------------------------------------------------------------------------

export async function refineBlend(
  _prevState: BlendState,
  formData: FormData,
): Promise<BlendState> {
  const session = await auth();
  if (!session) redirect("/login");

  const blendId = (formData.get("blendId") as string)?.trim();
  const instruction = (formData.get("instruction") as string)?.trim();

  if (!blendId || !instruction) {
    return { error: "入力が不足しています" };
  }

  // Get original blend
  const original = await getBlendResultDetail(blendId, session.user.id);
  if (!original) {
    return { error: "元の調合結果が見つかりません" };
  }

  // Apply refinement to existing keywords
  const refined = applyRefinement(original.keywords, instruction);

  const result = await executeBlend({
    userId: session.user.id,
    keywords: refined,
    topRatio: Number(original.ratios.top),
    middleRatio: Number(original.ratios.middle),
    lastRatio: Number(original.ratios.last),
    creatorId: original.creatorId ?? undefined,
    parentBlendId: blendId,
  });

  redirect(`/result/${result.blendRequestId}`);
}
