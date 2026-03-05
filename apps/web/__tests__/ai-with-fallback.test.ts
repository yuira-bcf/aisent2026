import type { ModelConfig } from "@/lib/ai/models";
import { withFallbackObject, withFallbackText } from "@/lib/ai/with-fallback";
import type { LanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Mock the "ai" module
// ---------------------------------------------------------------------------

vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

// We need to import the mocked functions to control their behavior
import { generateObject, generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);
const mockGenerateObject = vi.mocked(generateObject);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockModel = { provider: "mock", modelId: "mock-model" } as LanguageModel;
const mockFallbackModel = {
  provider: "mock",
  modelId: "mock-fallback",
} as LanguageModel;

const mockConfig: ModelConfig = {
  primary: mockModel,
  fallback: mockFallbackModel,
};

const defaultTextParams = {
  system: "test system prompt",
  prompt: "test prompt",
  maxTokens: 100,
  temperature: 0.5,
};

const testSchema = z.object({
  name: z.string(),
  score: z.number(),
});

const defaultObjectParams = {
  system: "test system prompt",
  prompt: "test prompt",
  schema: testSchema,
  temperature: 0.5,
};

// ---------------------------------------------------------------------------
// Tests: withFallbackText
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withFallbackText", () => {
  it("returns primary model result on success", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "primary result",
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await withFallbackText(
      mockConfig,
      defaultTextParams,
      () => "template fallback",
      "test",
    );

    expect(result).toBe("primary result");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("returns fallback model result when primary fails", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValueOnce({
        text: "fallback result",
      } as Awaited<ReturnType<typeof generateText>>);

    const result = await withFallbackText(
      mockConfig,
      defaultTextParams,
      () => "template fallback",
      "test",
    );

    expect(result).toBe("fallback result");
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("returns templateFn result when both models fail", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockRejectedValueOnce(new Error("fallback failed"));

    const result = await withFallbackText(
      mockConfig,
      defaultTextParams,
      () => "template fallback",
      "test",
    );

    expect(result).toBe("template fallback");
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: withFallbackObject
// ---------------------------------------------------------------------------

describe("withFallbackObject", () => {
  it("returns primary model result on success", async () => {
    const expected = { name: "test", score: 95 };
    mockGenerateObject.mockResolvedValueOnce({
      object: expected,
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const result = await withFallbackObject(
      mockConfig,
      defaultObjectParams,
      () => ({ name: "fallback", score: 0 }),
      "test",
    );

    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("returns fallback model result when primary fails", async () => {
    const expected = { name: "fallback-result", score: 80 };
    mockGenerateObject
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValueOnce({
        object: expected,
      } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const result = await withFallbackObject(
      mockConfig,
      defaultObjectParams,
      () => ({ name: "template", score: 0 }),
      "test",
    );

    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it("returns templateFn result when both models fail", async () => {
    const expected = { name: "template-result", score: 0 };
    mockGenerateObject
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockRejectedValueOnce(new Error("fallback failed"));

    const result = await withFallbackObject(
      mockConfig,
      defaultObjectParams,
      () => expected,
      "test",
    );

    expect(result).toEqual(expected);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });
});
