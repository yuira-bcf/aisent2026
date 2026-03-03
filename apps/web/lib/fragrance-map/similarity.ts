import { FLAVOR_COORDINATES } from "./flavor-coordinates";
import { REFERENCE_FRAGRANCES } from "./reference-fragrances";
import type { MapPosition, SimilarResult } from "./types";

/**
 * 配合ベクトルからマップ座標を算出（加重平均）
 * @param recipe flavorNameJa → ratio(%) のマップ
 */
export function calculatePosition(recipe: Record<string, number>): MapPosition {
  let x = 0;
  let y = 0;
  let totalWeight = 0;

  for (const [flavor, ratio] of Object.entries(recipe)) {
    const coord = FLAVOR_COORDINATES[flavor];
    if (coord && ratio > 0) {
      x += coord.x * ratio;
      y += coord.y * ratio;
      totalWeight += ratio;
    }
  }

  if (totalWeight === 0) return { x: 0, y: 0 };
  return { x: x / totalWeight, y: y / totalWeight };
}

/**
 * コサイン類似度を計算
 * 全26香料を次元として使用
 */
export function cosineSimilarity(
  vecA: Record<string, number>,
  vecB: Record<string, number>,
): number {
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of allKeys) {
    const a = vecA[key] ?? 0;
    const b = vecB[key] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * ユーザーの配合ベクトルに最も近いリファレンスフレグランスを返す
 * @param userVector flavorNameJa → ratio(比率、合計は問わない) のマップ
 * @param topN 返す件数（デフォルト3）
 */
export function findSimilarFragrances(
  userVector: Record<string, number>,
  topN = 3,
): SimilarResult[] {
  const results: SimilarResult[] = REFERENCE_FRAGRANCES.map((fragrance) => ({
    fragrance,
    similarity: cosineSimilarity(userVector, fragrance.vector),
  }));

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topN);
}
