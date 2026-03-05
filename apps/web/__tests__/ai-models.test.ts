import { type ModelPurpose, getModel } from "@/lib/ai/models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @ai-sdk/anthropic and @ai-sdk/openai to avoid real API key validation
// ---------------------------------------------------------------------------

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((modelId: string) => ({ provider: "anthropic", modelId })),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((modelId: string) => ({ provider: "openai", modelId })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getModel", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_MODEL_STORY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a ModelConfig with primary when ANTHROPIC_API_KEY is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

    const result = getModel("story");

    expect(result).not.toBeNull();
    expect(result?.primary).toBeDefined();
  });

  it("returns a ModelConfig with primary when OPENAI_API_KEY is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

    const result = getModel("story");

    expect(result).not.toBeNull();
    expect(result?.primary).toBeDefined();
  });

  it("returns null when both API keys are missing", () => {
    const result = getModel("story");

    expect(result).toBeNull();
  });

  it("allows env override via AI_MODEL_STORY", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
    vi.stubEnv("AI_MODEL_STORY", "gpt-4o");

    const result = getModel("story");

    expect(result).not.toBeNull();
    // Primary should be the overridden model (gpt-4o)
    expect((result?.primary as { modelId: string }).modelId).toBe("gpt-4o");
  });

  it("falls back to OpenAI models when only OPENAI_API_KEY is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

    const result = getModel("story");

    expect(result).not.toBeNull();
    // Both primary and fallback should be OpenAI models since Anthropic is unavailable
    expect((result?.primary as { provider: string }).provider).toBe("openai");
    expect((result?.fallback as { provider: string }).provider).toBe("openai");
  });

  it("falls back to Anthropic models when only ANTHROPIC_API_KEY is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

    const result = getModel("story");

    expect(result).not.toBeNull();
    // Both primary and fallback should be Anthropic models since OpenAI is unavailable
    expect((result?.primary as { provider: string }).provider).toBe(
      "anthropic",
    );
    expect((result?.fallback as { provider: string }).provider).toBe(
      "anthropic",
    );
  });

  it("returns ModelConfig for all valid purposes", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");

    const purposes: ModelPurpose[] = [
      "story",
      "structuredJson",
      "recipeDescription",
      "recommendation",
      "productCopy",
      "moderation",
    ];

    for (const purpose of purposes) {
      const result = getModel(purpose);
      expect(result).not.toBeNull();
      expect(result?.primary).toBeDefined();
      expect(result?.fallback).toBeDefined();
    }
  });
});
