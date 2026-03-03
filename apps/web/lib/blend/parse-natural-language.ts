// ---------------------------------------------------------------------------
// Natural language → keyword extraction for chat-based blend input
// ---------------------------------------------------------------------------

const SEASON_MAP: Record<string, string> = {
  春: "春",
  夏: "夏",
  秋: "秋",
  冬: "冬",
  spring: "春",
  summer: "夏",
  autumn: "秋",
  fall: "秋",
  winter: "冬",
};

const MOOD_MAP: Record<string, string> = {
  爽やか: "爽やか",
  さわやか: "爽やか",
  リラックス: "リラックス",
  落ち着: "リラックス",
  情熱: "情熱的",
  エレガント: "優雅",
  優雅: "優雅",
  甘い: "甘い",
  甘く: "甘い",
  スイート: "甘い",
  ウッディ: "ウッディ",
  木: "ウッディ",
  フローラル: "フローラル",
  花: "フローラル",
  華やか: "フローラル",
  シトラス: "シトラス",
  柑橘: "シトラス",
  レモン: "シトラス",
  ミステリアス: "ミステリアス",
  神秘: "ミステリアス",
  セクシー: "セクシー",
  清潔: "清潔感",
  クリーン: "清潔感",
  さっぱり: "爽やか",
  フレッシュ: "爽やか",
  fresh: "爽やか",
  スパイシー: "スパイシー",
  スパイス: "スパイシー",
  個性的: "個性的",
  ユニーク: "個性的",
};

const SCENE_MAP: Record<string, string> = {
  デート: "デート",
  オフィス: "オフィス",
  仕事: "オフィス",
  ビジネス: "オフィス",
  パーティー: "パーティー",
  パーティ: "パーティー",
  リゾート: "リゾート",
  旅行: "リゾート",
  就寝: "リラックス",
  睡眠: "リラックス",
  夜: "ナイト",
  ナイト: "ナイト",
  朝: "モーニング",
  モーニング: "モーニング",
  ギフト: "ギフト",
  プレゼント: "ギフト",
  記念日: "ギフト",
};

export type ExtractedKeyword = {
  word: string;
  weight: number;
  category: "SEASON" | "MOOD" | "PLACE";
};

export function parseNaturalLanguage(text: string): ExtractedKeyword[] {
  const results: ExtractedKeyword[] = [];
  const seen = new Set<string>();

  function addIfNew(
    word: string,
    weight: number,
    category: ExtractedKeyword["category"],
  ) {
    if (!seen.has(word)) {
      seen.add(word);
      results.push({ word, weight, category });
    }
  }

  // Check seasons (high weight for explicit season mentions)
  for (const [pattern, mapped] of Object.entries(SEASON_MAP)) {
    if (text.includes(pattern)) {
      addIfNew(mapped, 6, "SEASON");
    }
  }

  // Check moods (weight based on position - earlier = higher)
  for (const [pattern, mapped] of Object.entries(MOOD_MAP)) {
    const idx = text.indexOf(pattern);
    if (idx !== -1) {
      const positionWeight =
        idx < text.length / 3 ? 7 : idx < (text.length * 2) / 3 ? 5 : 4;
      addIfNew(mapped, positionWeight, "MOOD");
    }
  }

  // Check scenes
  for (const [pattern, mapped] of Object.entries(SCENE_MAP)) {
    const idx = text.indexOf(pattern);
    if (idx !== -1) {
      const positionWeight = idx < text.length / 3 ? 6 : 5;
      addIfNew(mapped, positionWeight, "PLACE");
    }
  }

  // If nothing extracted, add a generic keyword from the text
  if (results.length === 0 && text.trim().length > 0) {
    const trimmed = text.trim().slice(0, 30);
    addIfNew(trimmed, 5, "MOOD");
  }

  return results;
}

// Apply refinement instructions to existing keywords
export function applyRefinement(
  currentKeywords: { word: string; weight: number }[],
  instruction: string,
): { word: string; weight: number }[] {
  const extracted = parseNaturalLanguage(instruction);
  const result = [...currentKeywords];

  // Boost/adjust patterns
  const boostPatterns: Record<string, { keyword: string; delta: number }[]> = {
    もっと甘く: [{ keyword: "甘い", delta: 3 }],
    もっと爽やか: [{ keyword: "爽やか", delta: 3 }],
    ウッディ感を強く: [{ keyword: "ウッディ", delta: 3 }],
    フローラルを増やす: [{ keyword: "フローラル", delta: 3 }],
    秋バージョン: [{ keyword: "秋", delta: 5 }],
    もっと個性的: [{ keyword: "個性的", delta: 4 }],
  };

  for (const [pattern, adjustments] of Object.entries(boostPatterns)) {
    if (instruction.includes(pattern)) {
      for (const adj of adjustments) {
        const existing = result.find((k) => k.word === adj.keyword);
        if (existing) {
          existing.weight = Math.min(10, existing.weight + adj.delta);
        } else {
          result.push({
            word: adj.keyword,
            weight: Math.min(10, adj.delta + 3),
          });
        }
      }
    }
  }

  // Add any newly extracted keywords
  for (const kw of extracted) {
    if (!result.some((r) => r.word === kw.word)) {
      result.push({ word: kw.word, weight: kw.weight });
    }
  }

  return result;
}
