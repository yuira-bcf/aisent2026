import type { NoteType } from "@kyarainnovate/db/schema";

/**
 * Centralized design color tokens for KyaraInnovate.
 *
 * All note-type colors used across charts, gradients, and badges
 * should reference these constants instead of inline hex literals.
 */

// ---------------------------------------------------------------------------
// Note-type primary colors
// ---------------------------------------------------------------------------

/** Primary color per note type (used for single-color representations) */
export const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  TOP: "#F59E0B", // amber-500
  MIDDLE: "#EC4899", // pink-500
  LAST: "#059669", // emerald-600
};

/** Light variant per note type (used for chart fills, subtle backgrounds) */
export const NOTE_TYPE_COLORS_LIGHT: Record<NoteType, string> = {
  TOP: "#34D399", // emerald-400 (kept for compatibility with history/compare)
  MIDDLE: "#EC4899", // pink-500
  LAST: "#34D399", // emerald-400
};

// ---------------------------------------------------------------------------
// Note-type palettes (multi-flavor charts)
// ---------------------------------------------------------------------------

/** Extended palette for donut/pie charts with multiple flavors per note */
export const NOTE_PALETTE: Record<NoteType, string[]> = {
  TOP: [
    "#F59E0B",
    "#FBBF24",
    "#F97316",
    "#FCD34D",
    "#FB923C",
    "#D97706",
    "#EAB308",
    "#FDE047",
  ],
  MIDDLE: [
    "#EC4899",
    "#A855F7",
    "#F472B6",
    "#C084FC",
    "#E879F9",
    "#8B5CF6",
    "#D946EF",
    "#F9A8D4",
  ],
  LAST: [
    "#059669",
    "#0D9488",
    "#10B981",
    "#14B8A6",
    "#34D399",
    "#2DD4BF",
    "#047857",
    "#0F766E",
  ],
};

/** Pick a flavor color by its index within a note group */
export function getFlavorColor(
  noteType: NoteType,
  indexInNote: number,
): string {
  const palette = NOTE_PALETTE[noteType];
  return palette[indexInNote % palette.length];
}

// ---------------------------------------------------------------------------
// Decorative palettes (non-note-type usage)
// ---------------------------------------------------------------------------

/** Radar chart / multi-series colors (up to 6 series) */
export const SERIES_COLORS = [
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
] as const;

// ---------------------------------------------------------------------------
// Gradient helpers
// ---------------------------------------------------------------------------

/** Build a conic-gradient CSS string from TOP / MIDDLE / LAST ratios (0-100) */
export function noteConicGradient(
  topRatio: number,
  middleRatio: number,
  _lastRatio: number,
): string {
  const topEnd = topRatio;
  const midEnd = topEnd + middleRatio;
  return `conic-gradient(${NOTE_TYPE_COLORS.TOP} 0% ${topEnd}%, ${NOTE_TYPE_COLORS.MIDDLE} ${topEnd}% ${midEnd}%, #34d399 ${midEnd}% 100%)`;
}
