import { openai } from "@ai-sdk/openai";
import type { NoteType } from "@kyarainnovate/db/schema";
import { generateText } from "ai";

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

/**
 * Generate a story for a blend result.
 * Phase 1: Uses Vercel AI SDK directly
 * Phase 1.5: Will switch to Python AI Service call
 */
export async function generateStory(
  keywords: KeywordInfo[],
  flavors: FlavorInfo[],
  ratios: RatioInfo,
  options?: { styleDescription?: string },
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackStory(keywords, ratios);
  }

  try {
    const prompt = buildStoryPrompt(
      keywords,
      flavors,
      ratios,
      options?.styleDescription,
    );

    const systemPrompt = options?.styleDescription
      ? `あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。以下のクリエイターのスタイルを反映してください: ${options.styleDescription}`
      : "あなたは香りの専門家で、香料の配合から美しいストーリーを紡ぐ詩人です。";

    const { text } = await generateText({
      model: openai("gpt-4"),
      system: systemPrompt,
      prompt,
      maxTokens: 500,
      temperature: 0.8,
    });

    return text;
  } catch {
    return generateFallbackStory(keywords, ratios);
  }
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

/**
 * Suggest rules for a keyword using AI.
 * Phase 1: Uses Vercel AI SDK directly
 * Phase 1.5: Will switch to Python AI Service call
 */
export async function suggestRules(
  keyword: string,
  flavors: { id: string; nameEn: string; noteType: NoteType }[],
  options?: { aiInstruction?: string },
): Promise<{ flavorId: string; weight: number; noteType: NoteType }[]> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackSuggestion(flavors);
  }

  try {
    const flavorList = flavors
      .map((f) => `${f.nameEn} (${f.noteType})`)
      .join(", ");

    const systemPrompt = options?.aiInstruction
      ? `あなたは香水の調香師です。指定されたJSON形式のみで回答してください。\n\n以下のクリエイターの調合指示に従ってください:\n${options.aiInstruction}`
      : "あなたは香水の調香師です。指定されたJSON形式のみで回答してください。";

    const { text } = await generateText({
      model: openai("gpt-4"),
      system: systemPrompt,
      prompt: `キーワード「${keyword}」に関連する香料を以下のリストから選び、各ノートから2〜4種を選んでください。\n\n香料リスト: ${flavorList}\n\nJSON配列で回答（例）:\n[{"nameEn": "Lime", "noteType": "TOP", "weight": 0.8}]`,
      maxTokens: 800,
      temperature: 0.5,
    });

    const parsed = JSON.parse(text) as {
      nameEn: string;
      noteType: NoteType;
      weight: number;
    }[];

    const flavorMap = new Map(flavors.map((f) => [f.nameEn, f.id]));

    return parsed
      .filter((item) => flavorMap.has(item.nameEn))
      .map((item) => ({
        flavorId: flavorMap.get(item.nameEn)!,
        weight: Math.round(item.weight * 20) / 20, // Round to 0.05
        noteType: item.noteType,
      }));
  } catch {
    return generateFallbackSuggestion(flavors);
  }
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
