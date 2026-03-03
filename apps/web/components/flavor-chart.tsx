"use client";

import type { NoteType } from "@kyarainnovate/db/schema";

type FlavorEntry = {
  id: string;
  ratio: string;
  noteType: NoteType;
  flavor: {
    nameJa: string;
  };
};

import { NOTE_PALETTE, getFlavorColor } from "@/lib/colors";

export default function FlavorChart({ flavors }: { flavors: FlavorEntry[] }) {
  const noteCounters: Record<NoteType, number> = { TOP: 0, MIDDLE: 0, LAST: 0 };
  const data = flavors.map((f) => {
    const indexInNote = noteCounters[f.noteType]++;
    return {
      name: f.flavor.nameJa,
      value: Number.parseFloat(f.ratio),
      noteType: f.noteType,
      color: getFlavorColor(f.noteType, indexInNote),
    };
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-300">
        配合データなし
      </div>
    );
  }

  // Build conic-gradient segments
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  const gradientSegments = data.map((d) => {
    const start = (cumulative / total) * 100;
    cumulative += d.value;
    const end = (cumulative / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  });

  return (
    <div>
      <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">
        配合比率
      </h3>
      <div className="flex items-start gap-5">
        {/* Donut */}
        <div
          className="donut shrink-0"
          style={{
            width: "110px",
            height: "110px",
            background: `conic-gradient(${gradientSegments.join(", ")})`,
          }}
        >
          <div
            className="donut-hole"
            style={{
              width: "55px",
              height: "55px",
              top: "27.5px",
              left: "27.5px",
            }}
          >
            <span className="text-[9px] text-gray-400">{data.length}種</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1">
          <div className="space-y-0.5 text-[11px]">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: d.color }}
                />
                {d.name}
                <span className="ml-auto font-medium">
                  {d.value.toFixed(d.value % 1 === 0 ? 0 : 2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
