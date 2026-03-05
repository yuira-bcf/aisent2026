import {
  generateProductDescription,
  generateRecipeDescription,
  generateStory,
  moderateReviewAI,
  suggestRules,
} from "@/lib/ai-client";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/models", () => ({
  getModel: vi.fn(() => null),
}));

vi.mock("@/lib/ai/with-fallback", () => ({
  withFallbackText: vi.fn(),
  withFallbackObject: vi.fn(),
}));

import { getModel } from "@/lib/ai/models";
import { withFallbackObject, withFallbackText } from "@/lib/ai/with-fallback";

const mockGetModel = vi.mocked(getModel);
const mockWithFallbackText = vi.mocked(withFallbackText);
const mockWithFallbackObject = vi.mocked(withFallbackObject);

// ---------------------------------------------------------------------------
// Tests: generateStory
// ---------------------------------------------------------------------------

describe("generateStory", () => {
  const keywords = [{ word: "春", weight: 3 }];
  const flavors = [
    { nameJa: "ベルガモット", ratio: "50.00", noteType: "TOP" as const },
    { nameJa: "ローズ", ratio: "30.00", noteType: "MIDDLE" as const },
    { nameJa: "ムスク", ratio: "20.00", noteType: "LAST" as const },
  ];
  const ratios = { topRatio: 50, middleRatio: 30, lastRatio: 20 };

  it("returns fallback template when model is not available", async () => {
    mockGetModel.mockReturnValue(null);

    const result = await generateStory(keywords, flavors, ratios);

    expect(result).toContain("春");
    expect(result).toContain("トップノート");
    expect(result).toContain("50%");
    expect(mockWithFallbackText).not.toHaveBeenCalled();
  });

  it("calls withFallbackText when model is available", async () => {
    const mockConfig = {
      primary: { provider: "mock" },
      fallback: { provider: "mock" },
    };
    mockGetModel.mockReturnValue(mockConfig as ReturnType<typeof getModel>);
    mockWithFallbackText.mockResolvedValue("AI generated story");

    const result = await generateStory(keywords, flavors, ratios);

    expect(result).toBe("AI generated story");
    expect(mockWithFallbackText).toHaveBeenCalledTimes(1);
    expect(mockWithFallbackText).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({
        system: expect.any(String),
        prompt: expect.any(String),
        maxTokens: 500,
        temperature: 0.8,
      }),
      expect.any(Function),
      "story",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: suggestRules
// ---------------------------------------------------------------------------

describe("suggestRules", () => {
  const flavors = [
    { id: "f1", nameEn: "Bergamot", noteType: "TOP" as const },
    { id: "f2", nameEn: "Rose", noteType: "MIDDLE" as const },
    { id: "f3", nameEn: "Musk", noteType: "LAST" as const },
  ];

  it("returns fallback suggestions when model is not available", async () => {
    mockGetModel.mockReturnValue(null);

    const result = await suggestRules("spring", flavors);

    // Fallback picks up to 2 flavors per note type with weight 0.5
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.weight).toBe(0.5);
      expect(item.flavorId).toBeDefined();
    }
    expect(mockWithFallbackObject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: generateRecipeDescription
// ---------------------------------------------------------------------------

describe("generateRecipeDescription", () => {
  it("returns fallback description when model is not available", async () => {
    mockGetModel.mockReturnValue(null);

    const result = await generateRecipeDescription({
      recipeName: "Spring Breeze",
      scene: "春の庭",
      mood: "爽やか",
      flavors: [{ nameJa: "ベルガモット", ratio: 50, noteType: "TOP" }],
    });

    expect(result.shortDescription).toContain("春の庭");
    expect(result.shortDescription).toContain("爽やか");
    expect(result.fullDescription).toContain("Spring Breeze");
    expect(result.targetScene).toBe("春の庭");
    expect(result.keywords).toContain("春の庭");
    expect(result.keywords).toContain("爽やか");
  });
});

// ---------------------------------------------------------------------------
// Tests: moderateReviewAI
// ---------------------------------------------------------------------------

describe("moderateReviewAI", () => {
  it("returns isApproved: true when model is not available", async () => {
    mockGetModel.mockReturnValue(null);

    const result = await moderateReviewAI({
      reviewText: "素晴らしい香りです！",
      rating: 5,
      recipeName: "Spring Breeze",
    });

    expect(result.isApproved).toBe(true);
    expect(result.flags).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe("AI モデレーション未実行");
  });
});

// ---------------------------------------------------------------------------
// Tests: generateProductDescription
// ---------------------------------------------------------------------------

describe("generateProductDescription", () => {
  it("returns template text when model is not available", async () => {
    mockGetModel.mockReturnValue(null);

    const result = await generateProductDescription({
      productName: "Spring Breeze 30ml",
      recipeName: "Spring Breeze",
      concept: "春の爽やかさ",
      topFlavors: ["ベルガモット", "レモン"],
    });

    expect(result).toContain("Spring Breeze 30ml");
    expect(result).toContain("春の爽やかさ");
    expect(result).toContain("ベルガモット");
    expect(result).toContain("レモン");
  });
});
