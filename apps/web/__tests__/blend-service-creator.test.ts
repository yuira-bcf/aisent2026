import {
  type BlendRatios,
  type KeywordWeight,
  type ResultFlavor,
  type Rule,
  calculateAutoBlendGrouped,
} from "@/lib/blend-calculator";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers – replicate creator-style adjustment logic from blend-service.ts
// ---------------------------------------------------------------------------

/** Apply styleNoteBalance adjustment (same logic as blend-service step 5) */
function applyNoteBalance(
  ratios: BlendRatios,
  balance: { top?: number; middle?: number; last?: number },
): BlendRatios {
  let top = Math.max(0, Math.min(100, ratios.topRatio + (balance.top ?? 0)));
  let middle = Math.max(
    0,
    Math.min(100, ratios.middleRatio + (balance.middle ?? 0)),
  );
  let last = Math.max(0, Math.min(100, ratios.lastRatio + (balance.last ?? 0)));
  const sum = top + middle + last;
  if (sum > 0) {
    top = Math.round((top / sum) * 100);
    middle = Math.round((middle / sum) * 100);
    last = 100 - top - middle;
  }
  return { topRatio: top, middleRatio: middle, lastRatio: last };
}

/** Apply styleFlavorPreferences boost (same logic as blend-service step 6b) */
function applyFlavorPreferences(
  resultFlavors: ResultFlavor[],
  preferences: Record<string, number>,
): ResultFlavor[] {
  const boosted = resultFlavors.map((rf) => {
    const boost = preferences[rf.flavorId];
    if (boost !== undefined) {
      const newRatio = Math.max(0, Number(rf.ratio) + boost);
      return { ...rf, ratio: newRatio.toFixed(2) };
    }
    return { ...rf };
  });
  // Normalize back to 100
  const total = boosted.reduce((sum, rf) => sum + Number(rf.ratio), 0);
  if (total > 0) {
    return boosted.map((rf) => ({
      ...rf,
      ratio: ((Number(rf.ratio) / total) * 100).toFixed(2),
    }));
  }
  return boosted;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const kw1: KeywordWeight = { keywordId: "kw-floral", weight: 3 };
const kw2: KeywordWeight = { keywordId: "kw-citrus", weight: 2 };

const defaultRatios: BlendRatios = {
  topRatio: 35,
  middleRatio: 55,
  lastRatio: 10,
};

// Default rules (no creator)
const defaultRules = new Map<string, Rule[]>([
  [
    "kw-floral",
    [
      { flavorId: "f-rose", weight: "1.0", noteType: "TOP" },
      { flavorId: "f-jasmine", weight: "0.8", noteType: "MIDDLE" },
      { flavorId: "f-musk", weight: "0.3", noteType: "LAST" },
    ],
  ],
  [
    "kw-citrus",
    [
      { flavorId: "f-bergamot", weight: "1.0", noteType: "TOP" },
      { flavorId: "f-lemon", weight: "0.6", noteType: "MIDDLE" },
      { flavorId: "f-cedar", weight: "0.5", noteType: "LAST" },
    ],
  ],
]);

// Creator A rules – emphasizes floral, different weights
const creatorARules = new Map<string, Rule[]>([
  [
    "kw-floral",
    [
      { flavorId: "f-rose", weight: "1.5", noteType: "TOP" },
      { flavorId: "f-jasmine", weight: "1.2", noteType: "MIDDLE" },
      { flavorId: "f-sandalwood", weight: "0.8", noteType: "LAST" },
    ],
  ],
  [
    "kw-citrus",
    [
      { flavorId: "f-bergamot", weight: "0.5", noteType: "TOP" },
      { flavorId: "f-neroli", weight: "1.0", noteType: "MIDDLE" },
      { flavorId: "f-cedar", weight: "0.4", noteType: "LAST" },
    ],
  ],
]);

// Creator B rules – emphasizes citrus, completely different flavors for citrus
const creatorBRules = new Map<string, Rule[]>([
  [
    "kw-floral",
    [
      { flavorId: "f-rose", weight: "0.8", noteType: "TOP" },
      { flavorId: "f-lily", weight: "1.0", noteType: "MIDDLE" },
      { flavorId: "f-musk", weight: "0.6", noteType: "LAST" },
    ],
  ],
  [
    "kw-citrus",
    [
      { flavorId: "f-yuzu", weight: "1.2", noteType: "TOP" },
      { flavorId: "f-grapefruit", weight: "0.9", noteType: "MIDDLE" },
      { flavorId: "f-vetiver", weight: "0.7", noteType: "LAST" },
    ],
  ],
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Creator blend: rule filtering", () => {
  it("different creator rules produce different flavor selections", () => {
    const keywords = [kw1, kw2];

    const resultDefault = calculateAutoBlendGrouped(
      keywords,
      defaultRules,
      defaultRatios,
    );
    const resultA = calculateAutoBlendGrouped(
      keywords,
      creatorARules,
      defaultRatios,
    );
    const resultB = calculateAutoBlendGrouped(
      keywords,
      creatorBRules,
      defaultRatios,
    );

    // All should produce results
    expect(resultDefault.length).toBeGreaterThan(0);
    expect(resultA.length).toBeGreaterThan(0);
    expect(resultB.length).toBeGreaterThan(0);

    // Creator A and B should have different flavor sets
    const flavorsA = new Set(resultA.map((r) => r.flavorId));
    const flavorsB = new Set(resultB.map((r) => r.flavorId));
    const flavorsDefault = new Set(resultDefault.map((r) => r.flavorId));

    // Creator A has sandalwood + neroli, default does not
    expect(flavorsA.has("f-sandalwood")).toBe(true);
    expect(flavorsA.has("f-neroli")).toBe(true);
    expect(flavorsDefault.has("f-sandalwood")).toBe(false);
    expect(flavorsDefault.has("f-neroli")).toBe(false);

    // Creator B has yuzu + grapefruit + vetiver + lily
    expect(flavorsB.has("f-yuzu")).toBe(true);
    expect(flavorsB.has("f-grapefruit")).toBe(true);
    expect(flavorsB.has("f-lily")).toBe(true);
  });

  it("same keywords with different creators produce different ratios", () => {
    const keywords = [kw1, kw2];

    const resultA = calculateAutoBlendGrouped(
      keywords,
      creatorARules,
      defaultRatios,
    );
    const resultB = calculateAutoBlendGrouped(
      keywords,
      creatorBRules,
      defaultRatios,
    );

    // Both have rose but with different ratios (Creator A weight 1.5 vs B weight 0.8)
    const roseA = resultA.find((r) => r.flavorId === "f-rose");
    const roseB = resultB.find((r) => r.flavorId === "f-rose");
    expect(roseA).toBeDefined();
    expect(roseB).toBeDefined();
    expect(Number(roseA!.ratio)).not.toBeCloseTo(Number(roseB!.ratio), 1);
  });
});

describe("Creator blend: styleNoteBalance adjustment", () => {
  it("shifts ratios according to balance offsets", () => {
    // Creator emphasizes top notes (+20 top, -10 middle, -10 last)
    const adjusted = applyNoteBalance(defaultRatios, {
      top: 20,
      middle: -10,
      last: -10,
    });

    // Top should be higher than original 35
    expect(adjusted.topRatio).toBeGreaterThan(defaultRatios.topRatio);
    // Middle should be lower than original 55
    expect(adjusted.middleRatio).toBeLessThan(defaultRatios.middleRatio);
    // Sum should be exactly 100
    expect(adjusted.topRatio + adjusted.middleRatio + adjusted.lastRatio).toBe(
      100,
    );
  });

  it("normalizes ratios when adjustments push total beyond 100", () => {
    const adjusted = applyNoteBalance(
      { topRatio: 50, middleRatio: 30, lastRatio: 20 },
      { top: 30, middle: 30, last: 30 },
    );

    expect(adjusted.topRatio + adjusted.middleRatio + adjusted.lastRatio).toBe(
      100,
    );
  });

  it("clamps negative results to zero", () => {
    const adjusted = applyNoteBalance(
      { topRatio: 10, middleRatio: 10, lastRatio: 80 },
      { top: -50, middle: -50, last: 0 },
    );

    expect(adjusted.topRatio).toBe(0);
    expect(adjusted.middleRatio).toBe(0);
    expect(adjusted.lastRatio).toBe(100);
  });

  it("different balance produces different blend results", () => {
    const keywords = [kw1];
    const balancedA = applyNoteBalance(defaultRatios, {
      top: 20,
      middle: -10,
      last: -10,
    });
    const balancedB = applyNoteBalance(defaultRatios, {
      top: -20,
      middle: 10,
      last: 10,
    });

    const resultA = calculateAutoBlendGrouped(
      keywords,
      defaultRules,
      balancedA,
    );
    const resultB = calculateAutoBlendGrouped(
      keywords,
      defaultRules,
      balancedB,
    );

    const topA = resultA
      .filter((r) => r.noteType === "TOP")
      .reduce((sum, r) => sum + Number(r.ratio), 0);
    const topB = resultB
      .filter((r) => r.noteType === "TOP")
      .reduce((sum, r) => sum + Number(r.ratio), 0);

    // Creator A emphasizes top, creator B de-emphasizes top
    expect(topA).toBeGreaterThan(topB);
  });
});

describe("Creator blend: styleFlavorPreferences boost", () => {
  it("boosts preferred flavors and normalizes", () => {
    const results: ResultFlavor[] = [
      { flavorId: "f-rose", ratio: "35.00", noteType: "TOP" },
      { flavorId: "f-jasmine", ratio: "55.00", noteType: "MIDDLE" },
      { flavorId: "f-musk", ratio: "10.00", noteType: "LAST" },
    ];

    const boosted = applyFlavorPreferences(results, { "f-rose": 15 });

    const rose = boosted.find((r) => r.flavorId === "f-rose")!;
    const jasmine = boosted.find((r) => r.flavorId === "f-jasmine")!;

    // Rose should take a larger share after boost
    expect(Number(rose.ratio)).toBeGreaterThan(35);
    // Jasmine should shrink proportionally
    expect(Number(jasmine.ratio)).toBeLessThan(55);
    // Total should still be ~100
    const total = boosted.reduce((sum, r) => sum + Number(r.ratio), 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("negative boost reduces a flavor's share", () => {
    const results: ResultFlavor[] = [
      { flavorId: "f-rose", ratio: "50.00", noteType: "TOP" },
      { flavorId: "f-jasmine", ratio: "50.00", noteType: "MIDDLE" },
    ];

    const boosted = applyFlavorPreferences(results, { "f-rose": -20 });
    const rose = boosted.find((r) => r.flavorId === "f-rose")!;
    expect(Number(rose.ratio)).toBeLessThan(50);
  });

  it("does not go below zero", () => {
    const results: ResultFlavor[] = [
      { flavorId: "f-rose", ratio: "5.00", noteType: "TOP" },
      { flavorId: "f-jasmine", ratio: "95.00", noteType: "MIDDLE" },
    ];

    const boosted = applyFlavorPreferences(results, { "f-rose": -100 });
    const rose = boosted.find((r) => r.flavorId === "f-rose")!;
    expect(Number(rose.ratio)).toBeGreaterThanOrEqual(0);
  });
});

describe("Creator blend: backward compatibility", () => {
  it("no creator rules = default rules produce consistent results", () => {
    const keywords = [kw1, kw2];
    const result1 = calculateAutoBlendGrouped(
      keywords,
      defaultRules,
      defaultRatios,
    );
    const result2 = calculateAutoBlendGrouped(
      keywords,
      defaultRules,
      defaultRatios,
    );

    expect(result1).toEqual(result2);
  });

  it("no style adjustments leaves ratios unchanged", () => {
    const adjusted = applyNoteBalance(defaultRatios, {});
    expect(adjusted.topRatio).toBe(defaultRatios.topRatio);
    expect(adjusted.middleRatio).toBe(defaultRatios.middleRatio);
    expect(adjusted.lastRatio).toBe(defaultRatios.lastRatio);
  });

  it("empty flavor preferences leaves results unchanged", () => {
    const results: ResultFlavor[] = [
      { flavorId: "f-rose", ratio: "50.00", noteType: "TOP" },
      { flavorId: "f-jasmine", ratio: "50.00", noteType: "MIDDLE" },
    ];

    const boosted = applyFlavorPreferences(results, {});
    expect(boosted.map((r) => Number(r.ratio))).toEqual(
      results.map((r) => Number(r.ratio)),
    );
  });
});

describe("Creator blend: end-to-end simulation", () => {
  it("same keywords through two creators yield different final blends", () => {
    const keywords = [kw1, kw2];

    // Creator A: emphasizes top, boosts rose
    const ratiosA = applyNoteBalance(defaultRatios, {
      top: 15,
      middle: -5,
      last: -10,
    });
    const rawA = calculateAutoBlendGrouped(keywords, creatorARules, ratiosA);
    const finalA = applyFlavorPreferences(rawA, { "f-rose": 10 });

    // Creator B: emphasizes middle, boosts lily
    const ratiosB = applyNoteBalance(defaultRatios, {
      top: -10,
      middle: 15,
      last: -5,
    });
    const rawB = calculateAutoBlendGrouped(keywords, creatorBRules, ratiosB);
    const finalB = applyFlavorPreferences(rawB, { "f-lily": 10 });

    // Both should sum to ~100
    const totalA = finalA.reduce((s, r) => s + Number(r.ratio), 0);
    const totalB = finalB.reduce((s, r) => s + Number(r.ratio), 0);
    expect(totalA).toBeCloseTo(100, 0);
    expect(totalB).toBeCloseTo(100, 0);

    // Flavor selections should differ
    const flavorsA = new Set(finalA.map((r) => r.flavorId));
    const flavorsB = new Set(finalB.map((r) => r.flavorId));
    const union = new Set([...flavorsA, ...flavorsB]);
    const intersection = [...flavorsA].filter((f) => flavorsB.has(f));

    // Union should be larger than either set alone (different flavors used)
    expect(union.size).toBeGreaterThan(Math.max(flavorsA.size, flavorsB.size));
    // Not all flavors should be shared
    expect(intersection.length).toBeLessThan(union.size);
  });
});
