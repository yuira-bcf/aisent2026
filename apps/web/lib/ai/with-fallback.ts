import type { LanguageModel } from "ai";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import type { ModelConfig } from "./models";

// ---------------------------------------------------------------------------
// withFallbackText — 3-layer fallback for text generation
// ---------------------------------------------------------------------------

export async function withFallbackText(
  config: ModelConfig,
  params: {
    system: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
  },
  templateFn: () => string,
  purpose?: string,
): Promise<string> {
  // 1st: primary model
  try {
    const { text } = await generateText({
      model: config.primary,
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
    return text;
  } catch (e) {
    console.warn("[AI]", { purpose, layer: "primary", error: String(e) });
  }

  // 2nd: fallback model
  try {
    const { text } = await generateText({
      model: config.fallback,
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
    return text;
  } catch (e) {
    console.warn("[AI]", { purpose, layer: "fallback", error: String(e) });
  }

  // 3rd: template
  return templateFn();
}

// ---------------------------------------------------------------------------
// withFallbackObject — 3-layer fallback for structured output
// ---------------------------------------------------------------------------

export async function withFallbackObject<T>(
  config: ModelConfig,
  params: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
  },
  templateFn: () => T,
  purpose?: string,
): Promise<T> {
  async function tryModel(model: LanguageModel, layer: string): Promise<T> {
    const { object } = await generateObject({
      model,
      system: params.system,
      prompt: params.prompt,
      schema: params.schema,
      temperature: params.temperature ?? 0.5,
    });
    return object;
  }

  // 1st: primary model
  try {
    return await tryModel(config.primary, "primary");
  } catch (e) {
    console.warn("[AI]", { purpose, layer: "primary", error: String(e) });
  }

  // 2nd: fallback model
  try {
    return await tryModel(config.fallback, "fallback");
  } catch (e) {
    console.warn("[AI]", { purpose, layer: "fallback", error: String(e) });
  }

  // 3rd: template
  return templateFn();
}
