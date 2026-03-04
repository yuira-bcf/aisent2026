import {
  type BlendRatios,
  type KeywordWeight,
  type ResultFlavor,
  type Rule,
  calculateAutoBlend,
  calculateAutoBlendGrouped,
} from "@/lib/blend-calculator";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// C-25: Edge-case & real-world test vectors for blend calculator
// ---------------------------------------------------------------------------

/** Sum all ratio strings as numbers */
function sumRatios(results: ResultFlavor[]): number {
  return results.reduce((acc, r) => acc + Number(r.ratio), 0);
}

// ---------------------------------------------------------------------------
// Edge cases: Extreme weights
// ---------------------------------------------------------------------------

describe("calculateAutoBlend — extreme weights", () => {
  it("handles very large keyword weights without overflow", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 999999 }];
    const rules: Rule[] = [
      { flavorId: "f1", weight: "999.99", noteType: "TOP" },
      { flavorId: "f2", weight: "0.01", noteType: "TOP" },
    ];
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(sumRatios(result)).toBeCloseTo(100, 0);
    // f1 should dominate
    const f1 = result.find((r) => r.flavorId === "f1");
    expect(Number(f1?.ratio)).toBeGreaterThan(99);
  });

  it("handles fractional keyword weights", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 0.001 },
      { keywordId: "kw2", weight: 0.002 },
    ];
    const rules: Rule[] = [{ flavorId: "f1", weight: "1", noteType: "TOP" }];
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(1);
    expect(Number(result[0].ratio)).toBeCloseTo(100, 0);
  });

  it("handles very small rule weights (precision test)", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = [
      { flavorId: "f1", weight: "0.0001", noteType: "TOP" },
      { flavorId: "f2", weight: "0.0001", noteType: "TOP" },
    ];
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(2);
    expect(sumRatios(result)).toBeCloseTo(100, 0);
    // Equal weights → each ~50%
    expect(Number(result[0].ratio)).toBeCloseTo(50, 0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: All-equal ratios
// ---------------------------------------------------------------------------

describe("calculateAutoBlend — all-equal ratios", () => {
  it("splits evenly across note types with equal ratios", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = [
      { flavorId: "f-top", weight: "1", noteType: "TOP" },
      { flavorId: "f-mid", weight: "1", noteType: "MIDDLE" },
      { flavorId: "f-last", weight: "1", noteType: "LAST" },
    ];
    const ratios: BlendRatios = {
      topRatio: 33,
      middleRatio: 34,
      lastRatio: 33,
    };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(3);
    // Each should be close to 33%
    for (const r of result) {
      expect(Number(r.ratio)).toBeGreaterThanOrEqual(33);
      expect(Number(r.ratio)).toBeLessThanOrEqual(34);
    }
    expect(sumRatios(result)).toBeCloseTo(100, 0);
  });

  it("distributes equally among many flavors in same note", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = Array.from({ length: 10 }, (_, i) => ({
      flavorId: `f${i}`,
      weight: "1",
      noteType: "TOP" as const,
    }));
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(10);
    // Each should be exactly 10%
    for (const r of result) {
      expect(Number(r.ratio)).toBeCloseTo(10, 1);
    }
    expect(sumRatios(result)).toBeCloseTo(100, 0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: Single note type receives 100%
// ---------------------------------------------------------------------------

describe("calculateAutoBlend — single note concentration", () => {
  it("all TOP with multiple flavors, other notes empty", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 5 },
      { keywordId: "kw2", weight: 3 },
    ];
    const rules: Rule[] = [
      { flavorId: "citrus", weight: "3", noteType: "TOP" },
      { flavorId: "bergamot", weight: "2", noteType: "TOP" },
      { flavorId: "lavender", weight: "1", noteType: "MIDDLE" },
      { flavorId: "musk", weight: "1", noteType: "LAST" },
    ];
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    // Only TOP flavors should appear
    expect(result.every((r) => r.noteType === "TOP")).toBe(true);
    expect(sumRatios(result)).toBeCloseTo(100, 0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: Many keywords referencing same flavor
// ---------------------------------------------------------------------------

describe("calculateAutoBlendGrouped — score accumulation edge cases", () => {
  it("single flavor referenced by many keywords accumulates to 100%", () => {
    const keywords: KeywordWeight[] = Array.from({ length: 20 }, (_, i) => ({
      keywordId: `kw${i}`,
      weight: i + 1,
    }));
    const rulesByKeyword = new Map<string, Rule[]>();
    for (const kw of keywords) {
      rulesByKeyword.set(kw.keywordId, [
        { flavorId: "universal", weight: "1", noteType: "TOP" },
      ]);
    }
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlendGrouped(keywords, rulesByKeyword, ratios);

    expect(result).toHaveLength(1);
    expect(result[0].flavorId).toBe("universal");
    expect(Number(result[0].ratio)).toBeCloseTo(100, 1);
  });

  it("keywords with zero weight contribute nothing", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 0 },
      { keywordId: "kw2", weight: 5 },
    ];
    const rulesByKeyword = new Map<string, Rule[]>([
      ["kw1", [{ flavorId: "f-zero", weight: "10", noteType: "TOP" }]],
      ["kw2", [{ flavorId: "f-real", weight: "1", noteType: "TOP" }]],
    ]);
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlendGrouped(keywords, rulesByKeyword, ratios);

    // f-zero has weight 10*0=0, f-real has weight 1*5=5
    // Only f-real should effectively contribute
    const fReal = result.find((r) => r.flavorId === "f-real");
    expect(fReal).toBeDefined();
    expect(Number(fReal?.ratio)).toBeGreaterThan(0);
    expect(sumRatios(result)).toBeCloseTo(100, 0);
  });
});

// ---------------------------------------------------------------------------
// Real-world scenario: 調合シミュレーション
// ---------------------------------------------------------------------------

describe("Real-world blend scenarios", () => {
  it("春 × さわやか → citrus-dominant blend", () => {
    // Simulates a user selecting 春(weight=5) + さわやか(weight=3)
    const keywords: KeywordWeight[] = [
      { keywordId: "spring", weight: 5 },
      { keywordId: "fresh", weight: 3 },
    ];
    const rulesByKeyword = new Map<string, Rule[]>([
      [
        "spring",
        [
          { flavorId: "lemon", weight: "3.5", noteType: "TOP" },
          { flavorId: "orange", weight: "2.0", noteType: "TOP" },
          { flavorId: "lavender", weight: "2.5", noteType: "MIDDLE" },
          { flavorId: "daphne", weight: "1.5", noteType: "MIDDLE" },
          { flavorId: "musk", weight: "1.0", noteType: "LAST" },
        ],
      ],
      [
        "fresh",
        [
          { flavorId: "lemon", weight: "4.0", noteType: "TOP" },
          { flavorId: "seaBlue", weight: "2.0", noteType: "TOP" },
          { flavorId: "lavender", weight: "1.0", noteType: "MIDDLE" },
          { flavorId: "blackPepper", weight: "0.5", noteType: "LAST" },
        ],
      ],
    ]);
    const ratios: BlendRatios = {
      topRatio: 50,
      middleRatio: 30,
      lastRatio: 20,
    };

    const result = calculateAutoBlendGrouped(keywords, rulesByKeyword, ratios);

    // Total should be 100%
    expect(sumRatios(result)).toBeCloseTo(100, 0);

    // Lemon should be the dominant TOP note (high weight from both keywords)
    const topFlavors = result.filter((r) => r.noteType === "TOP");
    const lemon = topFlavors.find((r) => r.flavorId === "lemon");
    expect(lemon).toBeDefined();
    expect(Number(lemon?.ratio)).toBeGreaterThan(15); // should be significant

    // All three note types should be represented
    const noteTypes = new Set(result.map((r) => r.noteType));
    expect(noteTypes.has("TOP")).toBe(true);
    expect(noteTypes.has("MIDDLE")).toBe(true);
    expect(noteTypes.has("LAST")).toBe(true);
  });

  it("冬 × 高級 → heavy base with warm middle notes", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "winter", weight: 4 },
      { keywordId: "luxury", weight: 5 },
    ];
    const rulesByKeyword = new Map<string, Rule[]>([
      [
        "winter",
        [
          { flavorId: "cassis", weight: "2.0", noteType: "TOP" },
          { flavorId: "rose", weight: "3.0", noteType: "MIDDLE" },
          { flavorId: "sandalwood", weight: "4.0", noteType: "LAST" },
          { flavorId: "amber", weight: "3.0", noteType: "LAST" },
        ],
      ],
      [
        "luxury",
        [
          { flavorId: "bergamot", weight: "2.5", noteType: "TOP" },
          { flavorId: "rose", weight: "4.0", noteType: "MIDDLE" },
          { flavorId: "jasmine", weight: "2.0", noteType: "MIDDLE" },
          { flavorId: "sandalwood", weight: "5.0", noteType: "LAST" },
        ],
      ],
    ]);
    // Heavier base (LAST) ratio for winter luxury
    const ratios: BlendRatios = {
      topRatio: 30,
      middleRatio: 30,
      lastRatio: 40,
    };

    const result = calculateAutoBlendGrouped(keywords, rulesByKeyword, ratios);

    expect(sumRatios(result)).toBeCloseTo(100, 0);

    // Sandalwood should dominate LAST notes
    const lastFlavors = result.filter((r) => r.noteType === "LAST");
    const sandalwood = lastFlavors.find((r) => r.flavorId === "sandalwood");
    expect(sandalwood).toBeDefined();

    // Rose should be the dominant MIDDLE note
    const midFlavors = result.filter((r) => r.noteType === "MIDDLE");
    const rose = midFlavors.find((r) => r.flavorId === "rose");
    expect(rose).toBeDefined();
    if (midFlavors.length > 1) {
      const jasmine = midFlavors.find((r) => r.flavorId === "jasmine");
      expect(Number(rose?.ratio)).toBeGreaterThan(Number(jasmine?.ratio ?? 0));
    }
  });

  it("ratio format is always XX.XX (2 decimal places)", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 3 },
      { keywordId: "kw2", weight: 7 },
    ];
    const rules: Rule[] = [
      { flavorId: "a", weight: "1.333", noteType: "TOP" },
      { flavorId: "b", weight: "2.667", noteType: "MIDDLE" },
      { flavorId: "c", weight: "0.777", noteType: "LAST" },
    ];
    const ratios: BlendRatios = {
      topRatio: 40,
      middleRatio: 35,
      lastRatio: 25,
    };

    const result = calculateAutoBlend(keywords, rules, ratios);

    for (const r of result) {
      expect(r.ratio).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Precision & rounding
// ---------------------------------------------------------------------------

describe("Decimal precision and rounding", () => {
  it("handles thirds without precision loss (3 equal flavors)", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = [
      { flavorId: "a", weight: "1", noteType: "TOP" },
      { flavorId: "b", weight: "1", noteType: "TOP" },
      { flavorId: "c", weight: "1", noteType: "TOP" },
    ];
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(3);
    // Each should be ~33.33
    for (const r of result) {
      expect(Number(r.ratio)).toBeCloseTo(33.33, 1);
    }
    // Sum may not be exactly 100 due to rounding, but should be very close
    expect(sumRatios(result)).toBeCloseTo(100, 0);
  });

  it("handles sevenths without precision loss (7 equal flavors)", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = Array.from({ length: 7 }, (_, i) => ({
      flavorId: `f${i}`,
      weight: "1",
      noteType: "TOP" as const,
    }));
    const ratios: BlendRatios = { topRatio: 100, middleRatio: 0, lastRatio: 0 };

    const result = calculateAutoBlend(keywords, rules, ratios);

    expect(result).toHaveLength(7);
    for (const r of result) {
      expect(Number(r.ratio)).toBeCloseTo(14.29, 1);
    }
  });
});
