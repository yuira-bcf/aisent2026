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
// Helpers
// ---------------------------------------------------------------------------

/** Sum all ratio strings as numbers */
function sumRatios(results: ResultFlavor[]): number {
  return results.reduce((acc, r) => acc + Number(r.ratio), 0);
}

/** Filter results by noteType */
function byNote(
  results: ResultFlavor[],
  noteType: "TOP" | "MIDDLE" | "LAST",
): ResultFlavor[] {
  return results.filter((r) => r.noteType === noteType);
}

/** Sum ratios for a specific noteType */
function sumByNote(
  results: ResultFlavor[],
  noteType: "TOP" | "MIDDLE" | "LAST",
): number {
  return byNote(results, noteType).reduce((acc, r) => acc + Number(r.ratio), 0);
}

// ---------------------------------------------------------------------------
// Standard ratios used across multiple tests
// ---------------------------------------------------------------------------
const standardRatios: BlendRatios = {
  topRatio: 50,
  middleRatio: 30,
  lastRatio: 20,
};

const equalRatios: BlendRatios = {
  topRatio: 100,
  middleRatio: 0,
  lastRatio: 0,
};

// ---------------------------------------------------------------------------
// Tests: calculateAutoBlend
// ---------------------------------------------------------------------------

describe("calculateAutoBlend", () => {
  it("returns an empty array when there are no rules", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rules: Rule[] = [];

    const result = calculateAutoBlend(keywords, rules, standardRatios);

    expect(result).toEqual([]);
  });

  it("returns an empty array when there are no keywords", () => {
    const keywords: KeywordWeight[] = [];
    const rules: Rule[] = [{ flavorId: "f1", weight: "1", noteType: "TOP" }];

    const result = calculateAutoBlend(keywords, rules, standardRatios);

    expect(result).toEqual([]);
  });

  describe("single keyword, single rule per note type", () => {
    it("assigns the full note ratio to the sole flavor in each note type", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rules: Rule[] = [
        { flavorId: "f-top", weight: "1", noteType: "TOP" },
        { flavorId: "f-mid", weight: "1", noteType: "MIDDLE" },
        { flavorId: "f-last", weight: "1", noteType: "LAST" },
      ];

      const result = calculateAutoBlend(keywords, rules, standardRatios);

      // TOP flavor should get the full topRatio (50%)
      const topFlavors = byNote(result, "TOP");
      expect(topFlavors).toHaveLength(1);
      expect(topFlavors[0].flavorId).toBe("f-top");
      expect(Number(topFlavors[0].ratio)).toBeCloseTo(50, 1);

      // MIDDLE flavor should get the full middleRatio (30%)
      const midFlavors = byNote(result, "MIDDLE");
      expect(midFlavors).toHaveLength(1);
      expect(midFlavors[0].flavorId).toBe("f-mid");
      expect(Number(midFlavors[0].ratio)).toBeCloseTo(30, 1);

      // LAST flavor should get the full lastRatio (20%)
      const lastFlavors = byNote(result, "LAST");
      expect(lastFlavors).toHaveLength(1);
      expect(lastFlavors[0].flavorId).toBe("f-last");
      expect(Number(lastFlavors[0].ratio)).toBeCloseTo(20, 1);
    });
  });

  describe("multiple keywords with different weights", () => {
    it("accumulates weighted scores correctly across keywords", () => {
      const keywords: KeywordWeight[] = [
        { keywordId: "kw1", weight: 3 },
        { keywordId: "kw2", weight: 1 },
      ];

      // Both keywords share the same rules (calculateAutoBlend applies all
      // rules to all keywords). Two TOP flavors with different rule weights.
      const rules: Rule[] = [
        { flavorId: "f1", weight: "2", noteType: "TOP" },
        { flavorId: "f2", weight: "1", noteType: "TOP" },
      ];

      // ratios: topRatio=100 so everything falls in TOP
      const result = calculateAutoBlend(keywords, rules, equalRatios);

      // Score for f1: 2*3 + 2*1 = 8
      // Score for f2: 1*3 + 1*1 = 4
      // Normalized: f1 = 8/12 = 0.6667, f2 = 4/12 = 0.3333
      // Final:      f1 = 66.67%, f2 = 33.33%
      const f1 = result.find((r) => r.flavorId === "f1");
      const f2 = result.find((r) => r.flavorId === "f2");
      expect(f1).toBeDefined();
      expect(f2).toBeDefined();
      expect(Number(f1?.ratio)).toBeCloseTo(66.67, 1);
      expect(Number(f2?.ratio)).toBeCloseTo(33.33, 1);
    });
  });

  describe("note ratio distribution", () => {
    it("distributes flavors according to topRatio=50, middleRatio=30, lastRatio=20", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rules: Rule[] = [
        { flavorId: "f-top-1", weight: "1", noteType: "TOP" },
        { flavorId: "f-top-2", weight: "1", noteType: "TOP" },
        { flavorId: "f-mid-1", weight: "1", noteType: "MIDDLE" },
        { flavorId: "f-last-1", weight: "1", noteType: "LAST" },
        { flavorId: "f-last-2", weight: "1", noteType: "LAST" },
      ];

      const result = calculateAutoBlend(keywords, rules, standardRatios);

      // TOP flavors should sum to ~50%
      expect(sumByNote(result, "TOP")).toBeCloseTo(50, 0);
      // MIDDLE flavors should sum to ~30%
      expect(sumByNote(result, "MIDDLE")).toBeCloseTo(30, 0);
      // LAST flavors should sum to ~20%
      expect(sumByNote(result, "LAST")).toBeCloseTo(20, 0);
    });
  });

  describe("single flavor per note type", () => {
    it("gives the single flavor the full note ratio percentage", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 5 }];
      const rules: Rule[] = [
        { flavorId: "solo-top", weight: "3", noteType: "TOP" },
      ];
      const ratios: BlendRatios = {
        topRatio: 100,
        middleRatio: 0,
        lastRatio: 0,
      };

      const result = calculateAutoBlend(keywords, rules, ratios);

      expect(result).toHaveLength(1);
      expect(result[0].flavorId).toBe("solo-top");
      expect(Number(result[0].ratio)).toBeCloseTo(100, 1);
      expect(result[0].noteType).toBe("TOP");
    });
  });

  describe("zero-ratio flavors are filtered out", () => {
    it("excludes flavors with zero-weight note ratios", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rules: Rule[] = [
        { flavorId: "f-top", weight: "1", noteType: "TOP" },
        { flavorId: "f-mid", weight: "1", noteType: "MIDDLE" },
        { flavorId: "f-last", weight: "1", noteType: "LAST" },
      ];
      // middleRatio and lastRatio are 0, so those flavors should not appear
      const ratios: BlendRatios = {
        topRatio: 100,
        middleRatio: 0,
        lastRatio: 0,
      };

      const result = calculateAutoBlend(keywords, rules, ratios);

      expect(result).toHaveLength(1);
      expect(result[0].noteType).toBe("TOP");
    });
  });

  describe("all ratios sum to approximately 100%", () => {
    it("produces results that sum to ~100% with mixed note types", () => {
      const keywords: KeywordWeight[] = [
        { keywordId: "kw1", weight: 2 },
        { keywordId: "kw2", weight: 3 },
      ];
      const rules: Rule[] = [
        { flavorId: "f1", weight: "5", noteType: "TOP" },
        { flavorId: "f2", weight: "3", noteType: "TOP" },
        { flavorId: "f3", weight: "7", noteType: "MIDDLE" },
        { flavorId: "f4", weight: "2", noteType: "MIDDLE" },
        { flavorId: "f5", weight: "4", noteType: "LAST" },
      ];

      const result = calculateAutoBlend(keywords, rules, standardRatios);

      const total = sumRatios(result);
      // Total should be very close to 100% (small rounding variance allowed)
      expect(total).toBeCloseTo(100, 0);
    });

    it("sums to ~100% when all flavors are in one note type", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rules: Rule[] = [
        { flavorId: "a", weight: "1", noteType: "TOP" },
        { flavorId: "b", weight: "2", noteType: "TOP" },
        { flavorId: "c", weight: "3", noteType: "TOP" },
      ];

      const result = calculateAutoBlend(keywords, rules, equalRatios);

      expect(sumRatios(result)).toBeCloseTo(100, 0);
    });
  });

  describe("ratio values are formatted as decimal strings", () => {
    it("returns ratio as a string with 2 decimal places", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rules: Rule[] = [{ flavorId: "f1", weight: "1", noteType: "TOP" }];

      const result = calculateAutoBlend(keywords, rules, equalRatios);

      expect(result).toHaveLength(1);
      // Check it matches the format "XX.XX"
      expect(result[0].ratio).toMatch(/^\d+\.\d{2}$/);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: calculateAutoBlendGrouped
// ---------------------------------------------------------------------------

describe("calculateAutoBlendGrouped", () => {
  it("returns an empty array when no rules are provided", () => {
    const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
    const rulesByKeyword = new Map<string, Rule[]>();

    const result = calculateAutoBlendGrouped(
      keywords,
      rulesByKeyword,
      standardRatios,
    );

    expect(result).toEqual([]);
  });

  it("returns an empty array when no keywords are provided", () => {
    const rulesByKeyword = new Map<string, Rule[]>([
      ["kw1", [{ flavorId: "f1", weight: "1", noteType: "TOP" }]],
    ]);

    const result = calculateAutoBlendGrouped(
      [],
      rulesByKeyword,
      standardRatios,
    );

    expect(result).toEqual([]);
  });

  it("only applies rules associated with each keyword", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 1 },
      { keywordId: "kw2", weight: 1 },
    ];
    const rulesByKeyword = new Map<string, Rule[]>([
      ["kw1", [{ flavorId: "f-from-kw1", weight: "1", noteType: "TOP" }]],
      ["kw2", [{ flavorId: "f-from-kw2", weight: "1", noteType: "TOP" }]],
    ]);

    const result = calculateAutoBlendGrouped(
      keywords,
      rulesByKeyword,
      equalRatios,
    );

    // Both flavors should appear with equal weight
    expect(result).toHaveLength(2);
    const f1 = result.find((r) => r.flavorId === "f-from-kw1");
    const f2 = result.find((r) => r.flavorId === "f-from-kw2");
    expect(f1).toBeDefined();
    expect(f2).toBeDefined();
    expect(Number(f1?.ratio)).toBeCloseTo(50, 0);
    expect(Number(f2?.ratio)).toBeCloseTo(50, 0);
  });

  it("accumulates scores when multiple keywords reference the same flavor", () => {
    const keywords: KeywordWeight[] = [
      { keywordId: "kw1", weight: 2 },
      { keywordId: "kw2", weight: 3 },
    ];
    const rulesByKeyword = new Map<string, Rule[]>([
      ["kw1", [{ flavorId: "shared-f", weight: "1", noteType: "TOP" }]],
      ["kw2", [{ flavorId: "shared-f", weight: "1", noteType: "TOP" }]],
    ]);

    const result = calculateAutoBlendGrouped(
      keywords,
      rulesByKeyword,
      equalRatios,
    );

    // Single flavor should get 100%
    expect(result).toHaveLength(1);
    expect(result[0].flavorId).toBe("shared-f");
    expect(Number(result[0].ratio)).toBeCloseTo(100, 1);
  });

  describe("grouped output matches flat output for equivalent inputs", () => {
    it("produces identical results when rules are structured equivalently", () => {
      // For calculateAutoBlend, all rules are applied to all keywords,
      // so we construct the grouped version to mirror that behaviour:
      // give every keyword the same set of rules.
      const keywords: KeywordWeight[] = [
        { keywordId: "kw1", weight: 2 },
        { keywordId: "kw2", weight: 3 },
      ];

      const sharedRules: Rule[] = [
        { flavorId: "f1", weight: "5", noteType: "TOP" },
        { flavorId: "f2", weight: "3", noteType: "MIDDLE" },
        { flavorId: "f3", weight: "2", noteType: "LAST" },
      ];

      // Flat version: calculateAutoBlend applies all rules to all keywords
      const flatResult = calculateAutoBlend(
        keywords,
        sharedRules,
        standardRatios,
      );

      // Grouped version: same rules mapped to each keyword
      const rulesByKeyword = new Map<string, Rule[]>([
        ["kw1", sharedRules],
        ["kw2", sharedRules],
      ]);
      const groupedResult = calculateAutoBlendGrouped(
        keywords,
        rulesByKeyword,
        standardRatios,
      );

      // Sort both by flavorId for deterministic comparison
      const sortFn = (a: ResultFlavor, b: ResultFlavor) =>
        a.flavorId.localeCompare(b.flavorId);
      const sortedFlat = [...flatResult].sort(sortFn);
      const sortedGrouped = [...groupedResult].sort(sortFn);

      expect(sortedGrouped).toEqual(sortedFlat);
    });
  });

  describe("note ratio distribution in grouped mode", () => {
    it("distributes according to topRatio=50, middleRatio=30, lastRatio=20", () => {
      const keywords: KeywordWeight[] = [{ keywordId: "kw1", weight: 1 }];
      const rulesByKeyword = new Map<string, Rule[]>([
        [
          "kw1",
          [
            { flavorId: "f-top", weight: "1", noteType: "TOP" },
            { flavorId: "f-mid", weight: "1", noteType: "MIDDLE" },
            { flavorId: "f-last", weight: "1", noteType: "LAST" },
          ],
        ],
      ]);

      const result = calculateAutoBlendGrouped(
        keywords,
        rulesByKeyword,
        standardRatios,
      );

      expect(sumByNote(result, "TOP")).toBeCloseTo(50, 0);
      expect(sumByNote(result, "MIDDLE")).toBeCloseTo(30, 0);
      expect(sumByNote(result, "LAST")).toBeCloseTo(20, 0);
    });
  });

  describe("all ratios sum to approximately 100%", () => {
    it("produces a total near 100% across all note types", () => {
      const keywords: KeywordWeight[] = [
        { keywordId: "kw1", weight: 1 },
        { keywordId: "kw2", weight: 2 },
      ];
      const rulesByKeyword = new Map<string, Rule[]>([
        [
          "kw1",
          [
            { flavorId: "a", weight: "3", noteType: "TOP" },
            { flavorId: "b", weight: "2", noteType: "MIDDLE" },
          ],
        ],
        [
          "kw2",
          [
            { flavorId: "c", weight: "1", noteType: "MIDDLE" },
            { flavorId: "d", weight: "4", noteType: "LAST" },
          ],
        ],
      ]);

      const result = calculateAutoBlendGrouped(
        keywords,
        rulesByKeyword,
        standardRatios,
      );

      expect(sumRatios(result)).toBeCloseTo(100, 0);
    });
  });
});
