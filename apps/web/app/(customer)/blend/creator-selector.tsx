"use client";

import { useState } from "react";

type CreatorOption = {
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  tier: string;
};

const TIER_LABELS: Record<string, string> = {
  MASTER: "Master",
  PROFESSIONAL: "Pro",
  STANDARD: "Standard",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function CreatorSelector({
  creators,
  initialSlug,
  onSelect,
}: {
  creators: CreatorOption[];
  initialSlug?: string;
  onSelect: (creatorId: string | null) => void;
}) {
  const initial = initialSlug
    ? (creators.find((c) => c.creatorIdSlug === initialSlug) ?? null)
    : null;
  const [selected, setSelected] = useState<CreatorOption | null>(initial);

  function handleSelect(creator: CreatorOption) {
    if (selected?.userId === creator.userId) {
      setSelected(null);
      onSelect(null);
    } else {
      setSelected(creator);
      onSelect(creator.userId);
    }
  }

  return (
    <div className="flex gap-3">
      {creators.map((c) => {
        const isSelected = selected?.userId === c.userId;
        return (
          <button
            key={c.userId}
            type="button"
            onClick={() => handleSelect(c)}
            className={`flex-1 flex items-center gap-3 border p-3 transition ${
              isSelected
                ? "border-black bg-gray-50"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-gray-600">
                {getInitials(c.displayName)}
              </span>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-black truncate">
                {c.displayName}
              </p>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                {TIER_LABELS[c.tier] ?? c.tier}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
