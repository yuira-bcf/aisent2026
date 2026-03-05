import { getModel } from "@/lib/ai/models";
import {
  type CreatorRecommendation,
  type ModerationResult,
  type RecipeDescription,
  type RecipeRecommendation,
  creatorRecommendationSchema,
  moderationSchema,
  recipeDescriptionSchema,
  recipeRecommendationSchema,
  ruleSuggestionSchema,
} from "@/lib/ai/schemas";
import { withFallbackObject, withFallbackText } from "@/lib/ai/with-fallback";
import type { NoteType } from "@kyarainnovate/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlavorInfo = {
  nameJa: string;
  ratio: string;
  noteType: NoteType;
};

type KeywordInfo = {
  word: string;
  weight: number;
};

type RatioInfo = {
  topRatio: number;
  middleRatio: number;
  lastRatio: number;
};

// ---------------------------------------------------------------------------
// AI-01: generateStory — Generate a story for a blend result
// ---------------------------------------------------------------------------

export async function generateStory(
  keywords: KeywordInfo[],
  flavors: FlavorInfo[],
  ratios: RatioInfo,
  options?: { styleDescription?: string },
): Promise<string> {
  const modelConfig = getModel("story");
  if (!modelConfig) {
    return generateFallbackStory(keywords, ratios);
  }

  const systemPrompt = options?.styleDescription
    ? `あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。以下のクリエイターのスタイルを反映してください: ${options.styleDescription}`
    : "あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。";

  return withFallbackText(
    modelConfig,
    {
      system: systemPrompt,
      prompt: buildStoryPrompt(
        keywords,
        flavors,
        ratios,
        options?.styleDescription,
      ),
      maxTokens: 500,
      temperature: 0.8,
    },
    () => generateFallbackStory(keywords, ratios),
    "story",
  );
}

function buildStoryPrompt(
  keywords: KeywordInfo[],
  flavors: FlavorInfo[],
  ratios: RatioInfo,
  styleDescription?: string,
): string {
  const lines: string[] = [
    "あなたは香りのストーリーテラーです。以下の香料調合から、詩的で美しい香りのストーリーを日本語で200文字程度で作成してください。",
    "",
  ];

  if (styleDescription) {
    lines.push("【クリエイターのスタイル】", styleDescription, "");
  }

  lines.push("【キーワード】");

  for (const kw of keywords) {
    lines.push(`- ${kw.word} (重み: ${kw.weight})`);
  }

  lines.push("", "【配合】");

  const noteLabels: Record<NoteType, string> = {
    TOP: "トップノート",
    MIDDLE: "ミドルノート",
    LAST: "ラストノート",
  };

  const noteRatios: Record<NoteType, number> = {
    TOP: ratios.topRatio,
    MIDDLE: ratios.middleRatio,
    LAST: ratios.lastRatio,
  };

  for (const noteType of ["TOP", "MIDDLE", "LAST"] as NoteType[]) {
    lines.push(`${noteLabels[noteType]} (${noteRatios[noteType]}%):`);
    for (const f of flavors.filter((fl) => fl.noteType === noteType)) {
      lines.push(`  - ${f.nameJa}: ${f.ratio}%`);
    }
  }

  return lines.join("\n");
}

function generateFallbackStory(
  keywords: KeywordInfo[],
  ratios: RatioInfo,
): string {
  const kwText = keywords.map((kw) => `「${kw.word}」`).join("と");
  return `この香りは、${kwText}をイメージした調合です。トップノートが${ratios.topRatio}%、ミドルノートが${ratios.middleRatio}%、ラストノートが${ratios.lastRatio}%の構成で、時間とともに移り変わる香りのハーモニーをお楽しみください。`;
}

// ---------------------------------------------------------------------------
// AI-02: suggestRules — Suggest rules for a keyword using AI
// ---------------------------------------------------------------------------

export async function suggestRules(
  keyword: string,
  flavors: { id: string; nameEn: string; noteType: NoteType }[],
  options?: { aiInstruction?: string },
): Promise<{ flavorId: string; weight: number; noteType: NoteType }[]> {
  const modelConfig = getModel("structuredJson");
  if (!modelConfig) {
    return generateFallbackSuggestion(flavors);
  }

  const flavorList = flavors
    .map((f) => `${f.nameEn} (${f.noteType})`)
    .join(", ");

  const systemPrompt = options?.aiInstruction
    ? `あなたは香水の調香師です。\n\n以下のクリエイターの調合指示に従ってください:\n${options.aiInstruction}`
    : "あなたは香水の調香師です。";

  const result = await withFallbackObject(
    modelConfig,
    {
      system: systemPrompt,
      prompt: `キーワード「${keyword}」に関連する香料を以下のリストから選び、各ノートから2〜4種を選んでweight(0.0〜1.0)を設定してください。\n\n香料リスト: ${flavorList}`,
      schema: ruleSuggestionSchema,
      temperature: 0.5,
    },
    () =>
      generateFallbackSuggestion(flavors).map((f) => ({
        nameEn: flavors.find((fl) => fl.id === f.flavorId)?.nameEn ?? "",
        noteType: f.noteType,
        weight: f.weight,
      })),
    "structuredJson",
  );

  const flavorMap = new Map(flavors.map((f) => [f.nameEn, f.id]));

  return result
    .filter((item) => flavorMap.has(item.nameEn))
    .map((item) => ({
      flavorId: flavorMap.get(item.nameEn) ?? "",
      weight: Math.round(item.weight * 20) / 20,
      noteType: item.noteType,
    }));
}

function generateFallbackSuggestion(
  flavors: { id: string; nameEn: string; noteType: NoteType }[],
): { flavorId: string; weight: number; noteType: NoteType }[] {
  const result: { flavorId: string; weight: number; noteType: NoteType }[] = [];

  for (const noteType of ["TOP", "MIDDLE", "LAST"] as NoteType[]) {
    const noteFlavors = flavors.filter((f) => f.noteType === noteType);
    for (const f of noteFlavors.slice(0, 2)) {
      result.push({ flavorId: f.id, weight: 0.5, noteType });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// generateRecipeDescription — AI-generated recipe description
// ---------------------------------------------------------------------------

export async function generateRecipeDescription(params: {
  recipeName: string;
  scene: string;
  mood: string;
  flavors: { nameJa: string; ratio: number; noteType: string }[];
}): Promise<RecipeDescription> {
  const modelConfig = getModel("recipeDescription");
  const fallback = (): RecipeDescription => ({
    shortDescription: `${params.scene}の${params.mood}な香り`,
    fullDescription: `${params.recipeName}は、${params.scene}をテーマにした${params.mood}な香りです。`,
    targetScene: params.scene,
    keywords: [params.scene, params.mood],
  });

  if (!modelConfig) return fallback();

  return withFallbackObject(
    modelConfig,
    {
      system:
        "あなたは香水のコピーライターです。配合データから魅力的な説明文を作成します。shortDescriptionは50文字以内、fullDescriptionは200文字以内で作成してください。",
      prompt: `レシピ「${params.recipeName}」の説明文を作成してください。\nテーマ: ${params.scene} × ${params.mood}\n配合: ${params.flavors.map((f) => `${f.nameJa}(${f.noteType}) ${f.ratio}%`).join(", ")}`,
      schema: recipeDescriptionSchema,
      temperature: 0.7,
    },
    fallback,
    "recipeDescription",
  );
}

// ---------------------------------------------------------------------------
// recommendCreatorsAI — AI-powered creator recommendation
// ---------------------------------------------------------------------------

export async function recommendCreatorsAI(params: {
  userPreferences: { nameJa: string; affinity: number }[];
  creators: {
    id: string;
    name: string;
    styleDescription: string;
    topRecipes: string[];
  }[];
  limit: number;
}): Promise<CreatorRecommendation> {
  const modelConfig = getModel("recommendation");
  const fallback = (): CreatorRecommendation =>
    params.creators.slice(0, params.limit).map((c) => ({
      creatorId: c.id,
      matchScore: 50,
      reason: "人気のクリエーターです",
    }));

  if (!modelConfig) return fallback();

  return withFallbackObject(
    modelConfig,
    {
      system:
        "あなたはフレグランスのコンシェルジュです。ユーザーの好みに合うクリエーターを推薦します。matchScoreは0-100で評価し、reasonは日本語で簡潔に理由を述べてください。",
      prompt: `ユーザーの好みの香料: ${params.userPreferences
        .filter((f) => f.affinity > 0)
        .map((f) => f.nameJa)
        .join(
          ", ",
        )}\n\nクリエーター一覧:\n${params.creators.map((c) => `- ${c.name}(ID: ${c.id}): ${c.styleDescription} (代表作: ${c.topRecipes.join(", ")})`).join("\n")}\n\n上位${params.limit}名を推薦してください。`,
      schema: creatorRecommendationSchema,
      temperature: 0.3,
    },
    fallback,
    "recommendation",
  );
}

// ---------------------------------------------------------------------------
// recommendRecipesAI — AI-powered recipe recommendation
// ---------------------------------------------------------------------------

export async function recommendRecipesAI(params: {
  userPreferences: { nameJa: string; affinity: number }[];
  recipes: {
    id: string;
    name: string;
    concept: string;
    topFlavors: string[];
  }[];
  limit: number;
}): Promise<RecipeRecommendation> {
  const modelConfig = getModel("recommendation");
  const fallback = (): RecipeRecommendation =>
    params.recipes.slice(0, params.limit).map((r) => ({
      recipeId: r.id,
      matchScore: 50,
      reason: "人気のレシピです",
      highlightFlavor: r.topFlavors[0] ?? "",
    }));

  if (!modelConfig) return fallback();

  return withFallbackObject(
    modelConfig,
    {
      system:
        "あなたはフレグランスのコンシェルジュです。ユーザーの好みに合うレシピを推薦します。matchScoreは0-100で評価し、reasonは日本語で簡潔に理由を述べてください。",
      prompt: `ユーザーの好みの香料: ${params.userPreferences
        .filter((f) => f.affinity > 0)
        .map((f) => f.nameJa)
        .join(
          ", ",
        )}\n\nレシピ一覧:\n${params.recipes.map((r) => `- ${r.name}(ID: ${r.id}): ${r.concept} (主要香料: ${r.topFlavors.join(", ")})`).join("\n")}\n\n上位${params.limit}件を推薦してください。`,
      schema: recipeRecommendationSchema,
      temperature: 0.3,
    },
    fallback,
    "recommendation",
  );
}

// ---------------------------------------------------------------------------
// moderateReviewAI — AI-powered review moderation
// ---------------------------------------------------------------------------

export async function moderateReviewAI(params: {
  reviewText: string;
  rating: number;
  recipeName: string;
}): Promise<ModerationResult> {
  const modelConfig = getModel("moderation");
  const fallback = (): ModerationResult => ({
    isApproved: true,
    flags: [],
    confidence: 0,
    reason: "AI モデレーション未実行",
  });

  if (!modelConfig) return fallback();

  return withFallbackObject(
    modelConfig,
    {
      system:
        "あなたはレビューモデレーターです。レビューの内容を分析し、不適切な内容がないか確認します。スパム、嫌がらせ、不適切な表現、ステマ（やらせ）、個人情報の暴露、宣伝的な内容をチェックしてください。",
      prompt: `以下のレビューをモデレーションしてください。\n\n対象レシピ: ${params.recipeName}\n評価: ${params.rating}/5\nレビュー本文:\n${params.reviewText}`,
      schema: moderationSchema,
      temperature: 0.1,
    },
    fallback,
    "moderation",
  );
}

// ---------------------------------------------------------------------------
// generateProductDescription — AI-generated product description
// ---------------------------------------------------------------------------

export async function generateProductDescription(params: {
  productName: string;
  recipeName: string;
  concept: string;
  topFlavors: string[];
}): Promise<string> {
  const modelConfig = getModel("productCopy");
  const fallback = () =>
    `${params.productName}は、${params.concept}をテーマにした香水です。${params.topFlavors.join("、")}を中心とした調合で、あなただけの特別な香りをお届けします。`;

  if (!modelConfig) return fallback();

  return withFallbackText(
    modelConfig,
    {
      system:
        "あなたは香水ブランドのコピーライターです。商品の魅力を伝える説明文を150文字程度の日本語で作成してください。",
      prompt: `商品名: ${params.productName}\nレシピ: ${params.recipeName}\nコンセプト: ${params.concept}\n主要香料: ${params.topFlavors.join(", ")}`,
      maxTokens: 300,
      temperature: 0.7,
    },
    fallback,
    "productCopy",
  );
}
