// ---------------------------------------------------------------------------
// BlendChart – CSS conic-gradient donut chart (Server Component)
// No external dependencies – pure CSS implementation
// ---------------------------------------------------------------------------

const NOTE_COLORS: Record<string, string> = {
  TOP: "#f472b6", // pink-400
  MIDDLE: "#a78bfa", // violet-400
  LAST: "#f59e0b", // amber-500
};

const NOTE_LABELS: Record<string, string> = {
  TOP: "トップノート",
  MIDDLE: "ミドルノート",
  LAST: "ラストノート",
};

type Flavor = {
  flavorName: string;
  noteType: string;
  ratio: string;
};

export default function BlendChart({ flavors }: { flavors: Flavor[] }) {
  if (flavors.length === 0) return null;

  // Build conic-gradient stops
  const totalRatio = flavors.reduce(
    (sum, f) => sum + Number.parseFloat(f.ratio),
    0,
  );

  let accumulated = 0;
  const stops: string[] = [];

  for (const f of flavors) {
    const pct = (Number.parseFloat(f.ratio) / totalRatio) * 100;
    const color = NOTE_COLORS[f.noteType] ?? "#9ca3af";
    stops.push(`${color} ${accumulated}% ${accumulated + pct}%`);
    accumulated += pct;
  }

  const gradient = `conic-gradient(${stops.join(", ")})`;

  // Group flavors by noteType for legend
  const grouped = new Map<string, Flavor[]>();
  for (const f of flavors) {
    const list = grouped.get(f.noteType) ?? [];
    list.push(f);
    grouped.set(f.noteType, list);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      {/* Donut */}
      <div className="relative w-40 h-40 flex-shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white" />
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3 text-sm">
        {(["TOP", "MIDDLE", "LAST"] as const).map((note) => {
          const items = grouped.get(note);
          if (!items) return null;
          return (
            <div key={note}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: NOTE_COLORS[note] }}
                />
                <span className="font-medium text-gray-700">
                  {NOTE_LABELS[note]}
                </span>
              </div>
              <div className="ml-5 text-xs text-gray-500 space-y-0.5">
                {items.map((item) => (
                  <div key={`${item.noteType}-${item.flavorName}`}>
                    {item.flavorName} (
                    {(
                      (Number.parseFloat(item.ratio) / totalRatio) *
                      100
                    ).toFixed(1)}
                    %)
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
