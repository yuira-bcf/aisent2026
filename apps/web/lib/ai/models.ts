import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// ---------------------------------------------------------------------------
// Available models
// ---------------------------------------------------------------------------

type ModelKey =
  | "claude-sonnet-4.5"
  | "claude-haiku-4.5"
  | "gpt-4o"
  | "gpt-4o-mini";

const AVAILABLE_MODELS: Record<ModelKey, () => LanguageModel> = {
  "claude-sonnet-4.5": () => anthropic("claude-sonnet-4-5-20250514"),
  "claude-haiku-4.5": () => anthropic("claude-haiku-4-5-20251001"),
  "gpt-4o": () => openai("gpt-4o"),
  "gpt-4o-mini": () => openai("gpt-4o-mini"),
};

// ---------------------------------------------------------------------------
// Model assignments by purpose
// ---------------------------------------------------------------------------

export type ModelPurpose =
  | "story"
  | "structuredJson"
  | "recipeDescription"
  | "recommendation"
  | "productCopy"
  | "moderation";

const MODEL_ASSIGNMENTS: Record<
  ModelPurpose,
  { primary: ModelKey; fallback: ModelKey }
> = {
  story: { primary: "claude-sonnet-4.5", fallback: "gpt-4o" },
  structuredJson: { primary: "claude-sonnet-4.5", fallback: "gpt-4o-mini" },
  recipeDescription: { primary: "claude-sonnet-4.5", fallback: "gpt-4o" },
  recommendation: { primary: "claude-sonnet-4.5", fallback: "gpt-4o-mini" },
  productCopy: { primary: "claude-sonnet-4.5", fallback: "gpt-4o" },
  moderation: { primary: "claude-sonnet-4.5", fallback: "gpt-4o-mini" },
};

// ---------------------------------------------------------------------------
// Model config type
// ---------------------------------------------------------------------------

export type ModelConfig = {
  primary: LanguageModel;
  fallback: LanguageModel;
};

// ---------------------------------------------------------------------------
// getModel — Resolve a model pair for a given purpose
// ---------------------------------------------------------------------------

export function getModel(purpose: ModelPurpose): ModelConfig | null {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasAnthropic && !hasOpenAI) return null;

  const config = MODEL_ASSIGNMENTS[purpose];

  // Allow env override: AI_MODEL_STORY=gpt-4o etc.
  const envKey = `AI_MODEL_${purpose.toUpperCase()}`;
  const envOverride = process.env[envKey] as ModelKey | undefined;

  let primaryKey: ModelKey =
    envOverride && envOverride in AVAILABLE_MODELS
      ? envOverride
      : config.primary;
  let fallbackKey: ModelKey = config.fallback;

  // If Anthropic key is missing, use OpenAI for Claude models
  if (!hasAnthropic) {
    if (primaryKey.startsWith("claude")) primaryKey = fallbackKey;
    if (fallbackKey.startsWith("claude")) fallbackKey = primaryKey;
  }

  // If OpenAI key is missing, use Anthropic for OpenAI models
  if (!hasOpenAI) {
    if (fallbackKey.startsWith("gpt")) fallbackKey = primaryKey;
    if (primaryKey.startsWith("gpt")) primaryKey = fallbackKey;
  }

  return {
    primary: AVAILABLE_MODELS[primaryKey](),
    fallback: AVAILABLE_MODELS[fallbackKey](),
  };
}
