import type { NoteType } from "@kyarainnovate/db/schema";
import Decimal from "decimal.js";

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export type KeywordWeight = {
  keywordId: string;
  weight: number;
};

export type Rule = {
  flavorId: string;
  weight: string; // decimal string
  noteType: NoteType;
};

export type BlendRatios = {
  topRatio: number;
  middleRatio: number;
  lastRatio: number;
};

export type ResultFlavor = {
  flavorId: string;
  ratio: string; // decimal string, e.g. "20.00"
  noteType: NoteType;
};

/**
 * Auto-blend calculation ported from BlendGenerationService.java
 *
 * Algorithm:
 *   1. For each keyword, multiply rule.weight × keyword.weight
 *   2. Accumulate by noteType and flavorId
 *   3. Normalize per noteType (sum = 1.0)
 *   4. Multiply by noteRatio to get final percentage
 */
export function calculateAutoBlend(
  keywordWeights: KeywordWeight[],
  rules: Rule[],
  ratios: BlendRatios,
): ResultFlavor[] {
  // Group rules by keyword for efficient lookup
  const rulesByKeyword = new Map<string, Rule[]>();
  for (const rule of rules) {
    // rules are already filtered by relevant keywords
  }

  // Step 1-2: Accumulate weighted scores per noteType per flavorId
  const noteFlavorWeights: Record<NoteType, Map<string, Decimal>> = {
    TOP: new Map(),
    MIDDLE: new Map(),
    LAST: new Map(),
  };

  for (const kw of keywordWeights) {
    const userWeight = new Decimal(kw.weight);
    const keywordRules = rules.filter(
      (r) =>
        // Rules should already be filtered for this keyword externally
        true,
    );

    for (const rule of keywordRules) {
      const combined = new Decimal(rule.weight).mul(userWeight);
      const noteMap = noteFlavorWeights[rule.noteType];
      const existing = noteMap.get(rule.flavorId) ?? new Decimal(0);
      noteMap.set(rule.flavorId, existing.add(combined));
    }
  }

  // Step 3: Normalize per noteType
  const normalizedWeights: Record<NoteType, Map<string, Decimal>> = {
    TOP: normalize(noteFlavorWeights.TOP),
    MIDDLE: normalize(noteFlavorWeights.MIDDLE),
    LAST: normalize(noteFlavorWeights.LAST),
  };

  // Step 4: Apply note ratios
  const noteRatios: Record<NoteType, Decimal> = {
    TOP: new Decimal(ratios.topRatio).div(100),
    MIDDLE: new Decimal(ratios.middleRatio).div(100),
    LAST: new Decimal(ratios.lastRatio).div(100),
  };

  const results: ResultFlavor[] = [];

  for (const noteType of ["TOP", "MIDDLE", "LAST"] as NoteType[]) {
    const weights = normalizedWeights[noteType];
    const noteRatio = noteRatios[noteType];

    for (const [flavorId, weight] of weights) {
      const ratio = weight.mul(noteRatio).mul(100).toDecimalPlaces(2);

      if (ratio.gt(0)) {
        results.push({
          flavorId,
          ratio: ratio.toFixed(2),
          noteType,
        });
      }
    }
  }

  return results;
}

/**
 * Normalize a weight map so all values sum to 1.0
 * Ported from BlendGenerationService.normalize()
 */
function normalize(weights: Map<string, Decimal>): Map<string, Decimal> {
  if (weights.size === 0) return weights;

  let total = new Decimal(0);
  for (const v of weights.values()) {
    total = total.add(v);
  }

  if (total.eq(0)) return weights;

  const normalized = new Map<string, Decimal>();
  for (const [key, value] of weights) {
    normalized.set(key, value.div(total).toDecimalPlaces(4));
  }
  return normalized;
}

/**
 * Alternative: Calculate with pre-grouped rules per keyword
 * More efficient for DB queries that return rules grouped by keyword
 */
export function calculateAutoBlendGrouped(
  keywordWeights: KeywordWeight[],
  rulesByKeywordId: Map<string, Rule[]>,
  ratios: BlendRatios,
): ResultFlavor[] {
  const noteFlavorWeights: Record<NoteType, Map<string, Decimal>> = {
    TOP: new Map(),
    MIDDLE: new Map(),
    LAST: new Map(),
  };

  for (const kw of keywordWeights) {
    const userWeight = new Decimal(kw.weight);
    const kwRules = rulesByKeywordId.get(kw.keywordId) ?? [];

    for (const rule of kwRules) {
      const combined = new Decimal(rule.weight).mul(userWeight);
      const noteMap = noteFlavorWeights[rule.noteType];
      const existing = noteMap.get(rule.flavorId) ?? new Decimal(0);
      noteMap.set(rule.flavorId, existing.add(combined));
    }
  }

  const normalizedWeights: Record<NoteType, Map<string, Decimal>> = {
    TOP: normalize(noteFlavorWeights.TOP),
    MIDDLE: normalize(noteFlavorWeights.MIDDLE),
    LAST: normalize(noteFlavorWeights.LAST),
  };

  const noteRatios: Record<NoteType, Decimal> = {
    TOP: new Decimal(ratios.topRatio).div(100),
    MIDDLE: new Decimal(ratios.middleRatio).div(100),
    LAST: new Decimal(ratios.lastRatio).div(100),
  };

  const results: ResultFlavor[] = [];

  for (const noteType of ["TOP", "MIDDLE", "LAST"] as NoteType[]) {
    const weights = normalizedWeights[noteType];
    const noteRatio = noteRatios[noteType];

    for (const [flavorId, weight] of weights) {
      const ratio = weight.mul(noteRatio).mul(100).toDecimalPlaces(2);
      if (ratio.gt(0)) {
        results.push({ flavorId, ratio: ratio.toFixed(2), noteType });
      }
    }
  }

  return results;
}
