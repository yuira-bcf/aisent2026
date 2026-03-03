"use client";

import Link from "next/link";

type FlavorData = {
  name: string;
  percentage: number;
  colorHex: string;
};

type BlendData = {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  keywords: string[];
  topRatio: number;
  middleRatio: number;
  lastRatio: number;
  flavors: FlavorData[];
};

function buildConicGradient(flavors: FlavorData[]): string {
  if (flavors.length === 0) return "conic-gradient(#e5e7eb 0% 100%)";
  let acc = 0;
  const stops = flavors.map((f) => {
    const start = acc;
    acc += f.percentage;
    return `${f.colorHex} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function computeFlavorDiffs(
  parentFlavors: FlavorData[],
  currentFlavors: FlavorData[],
): Map<string, string> {
  const parentMap = new Map(parentFlavors.map((f) => [f.name, f.percentage]));
  const diffs = new Map<string, string>();
  for (const f of currentFlavors) {
    const parentPct = parentMap.get(f.name);
    if (parentPct === undefined) {
      diffs.set(f.name, "new");
    } else {
      const diff = f.percentage - parentPct;
      if (diff !== 0) {
        diffs.set(f.name, diff > 0 ? `+${diff}` : `${diff}`);
      }
    }
  }
  return diffs;
}

// Static similar fragrances for display
const SIMILAR_V1 = [
  { name: "Daisy", pct: 87, color: "bg-pink-400" },
  { name: "L'Eau d'Issey", pct: 82, color: "bg-pink-300" },
  { name: "CK One", pct: 76, color: "bg-pink-200" },
];

const SIMILAR_V2 = [
  { name: "Chanel No.5", pct: 84, color: "bg-pink-400" },
  { name: "La Vie Est Belle", pct: 79, color: "bg-pink-300" },
  { name: "Daisy", pct: 74, color: "bg-pink-200" },
];

function VersionColumn({
  data,
  isAdopted,
  flavorDiffs,
  similarFragrances,
}: {
  data: BlendData;
  isAdopted: boolean;
  flavorDiffs?: Map<string, string>;
  similarFragrances: { name: string; pct: number; color: string }[];
}) {
  const gradient = buildConicGradient(data.flavors);

  return (
    <div
      className={`card p-4 flex flex-col min-h-0 relative overflow-auto ${
        isAdopted ? "border-black border-2" : "opacity-60"
      }`}
    >
      {/* Badge */}
      <div className="absolute top-3 right-3">
        {isAdopted ? (
          <span className="badge bg-black text-white">
            v{data.version} 採用
          </span>
        ) : (
          <span className="badge bg-gray-100 text-gray-500">
            v{data.version} 旧版
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2 shrink-0">
        v{data.version} — {data.name}
      </h3>

      {/* Donut */}
      <div className="flex justify-center mb-2 shrink-0">
        <div
          className="donut"
          style={{
            width: 100,
            height: 100,
            background: gradient,
          }}
        >
          <div
            className="donut-hole"
            style={{ width: 50, height: 50, top: 25, left: 25 }}
          >
            <span className="text-[8px] text-gray-400">
              {data.flavors.length}種
            </span>
          </div>
        </div>
      </div>

      {/* Flavor list */}
      <div className="space-y-0.5 text-[10px] flex-1 min-h-0">
        {data.flavors.map((f) => {
          const diff = flavorDiffs?.get(f.name);
          return (
            <div key={f.name} className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: f.colorHex }}
              />
              {f.name}
              <span className="ml-auto font-medium">{f.percentage}%</span>
              {diff && (
                <span
                  className={`text-[8px] ml-1 ${
                    diff === "new" ? "text-green-500" : "text-gray-300"
                  }`}
                >
                  {diff}
                </span>
              )}
            </div>
          );
        })}
        {data.flavors.length === 0 && (
          <p className="text-gray-300">フレーバーデータなし</p>
        )}
      </div>

      {/* Similar fragrances */}
      <div className="border-t border-gray-100 pt-2 mt-2 shrink-0">
        <p className="text-[9px] text-gray-400 mb-1">近い香り</p>
        <div className="space-y-0.5 text-[10px]">
          {similarFragrances.map((s) => (
            <div key={s.name} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
              {s.name}
              <span className="ml-auto text-gray-400">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FragranceMap() {
  return (
    <div className="card p-3 flex-1 flex flex-col min-h-0">
      <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2 shrink-0">
        フレグランスマップ — バージョン比較
      </h3>
      <div className="relative bg-gray-50 border border-gray-100 flex-1 min-h-0">
        {/* Cross-hair axes */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />

        {/* Axis labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-blue-500">
          ← フレッシュ
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-red-500">
          ウォーム →
        </span>
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-pink-500">
          フローラル ↑
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-green-700">
          ↓ ウッディ
        </span>

        {/* Reference dots */}
        {[
          { left: "20%", top: "25%", name: "Chanel No.5" },
          { left: "30%", top: "60%", name: "Acqua di Gio" },
          { left: "15%", top: "45%", name: "CK One" },
          { left: "65%", top: "20%", name: "Black Opium" },
          { left: "75%", top: "65%", name: "Oud Wood" },
          { left: "55%", top: "35%", name: "La Vie Est Belle" },
          { left: "40%", top: "70%", name: "Bleu de Chanel" },
          { left: "25%", top: "35%", name: "Daisy" },
          { left: "60%", top: "50%", name: "Shalimar" },
          { left: "45%", top: "40%", name: "L'Eau d'Issey" },
        ].map((dot) => (
          <div
            key={dot.name}
            title={dot.name}
            className="absolute w-[6px] h-[6px] rounded-full bg-gray-300 -translate-x-1/2 -translate-y-1/2"
            style={{ left: dot.left, top: dot.top }}
          />
        ))}

        {/* v1 marker */}
        <div
          className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            left: "32%",
            top: "42%",
            background: "#9ca3af",
            borderColor: "#9ca3af",
            boxShadow: "0 0 0 2px #9ca3af",
          }}
        />
        <span
          className="absolute text-[8px] text-gray-400 font-medium"
          style={{ left: "28%", top: "35%" }}
        >
          v1
        </span>

        {/* Arrow from v1 to v2 */}
        <svg
          className="absolute"
          style={{
            left: "33%",
            top: "30%",
            width: 40,
            height: 40,
            overflow: "visible",
          }}
          viewBox="0 0 40 40"
        >
          <defs>
            <marker
              id="ah"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <path d="M0,0 L6,2 L0,4" fill="#000" />
            </marker>
          </defs>
          <line
            x1="2"
            y1="35"
            x2="30"
            y2="5"
            stroke="#000"
            strokeWidth="1.5"
            strokeDasharray="3,2"
            markerEnd="url(#ah)"
          />
        </svg>

        {/* v2 marker */}
        <div
          className="absolute w-3 h-3 rounded-full bg-black -translate-x-1/2 -translate-y-1/2"
          style={{ left: "38%", top: "28%", boxShadow: "0 0 0 2px #000" }}
        />
        <span
          className="absolute text-[8px] font-bold text-black"
          style={{ left: "40%", top: "21%" }}
        >
          v2
        </span>

        {/* v2 Similar highlights */}
        {[
          {
            left: "22%",
            top: "27%",
            name: "Chanel No.5 84%",
            color: "bg-pink-400",
          },
          {
            left: "56%",
            top: "36%",
            name: "La Vie Est Belle 79%",
            color: "bg-pink-300",
          },
          { left: "26%", top: "36%", name: "Daisy 74%", color: "bg-pink-200" },
        ].map((dot) => (
          <div
            key={dot.name}
            title={dot.name}
            className={`absolute w-[10px] h-[10px] rounded-full ${dot.color} -translate-x-1/2 -translate-y-1/2`}
            style={{ left: dot.left, top: dot.top }}
          />
        ))}
      </div>
    </div>
  );
}

function StoryPanel() {
  return (
    <div className="card p-3 flex flex-col min-h-0">
      <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-1.5 shrink-0">
        ストーリー (v2)
      </h3>
      <p className="text-[11px] text-gray-600 leading-relaxed flex-1 min-h-0 overflow-hidden">
        夕暮れの海辺、潮風にのせてレモンとベルガモットの光が弾ける。やがてローズとラベンダーの花びらが風に舞い、甘いバニラのヴェールがすべてを包み込む。ホワイトムスクのやわらかな余韻が肌に溶ける。
      </p>
      <p className="text-[8px] text-gray-300 mt-1 shrink-0">
        Generated by GPT-4
      </p>
    </div>
  );
}

function ChatLogPanel() {
  return (
    <div className="card p-3 flex flex-col min-h-0">
      <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-1.5 shrink-0">
        会話ログ (2往復)
      </h3>
      <div className="space-y-2 flex-1 min-h-0 overflow-hidden text-[10px]">
        {/* User message 1 */}
        <div className="flex gap-1.5 items-start">
          <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-[7px]">
            👤
          </span>
          <div>
            <p className="text-gray-600">
              夏のデートに使いたい。爽やかだけど少し甘さもある、優雅な香り
            </p>
            <p className="text-[8px] text-gray-300">13:45</p>
          </div>
        </div>
        {/* AI response 1 */}
        <div className="flex gap-1.5 items-start">
          <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center shrink-0 text-[7px] text-white font-bold">
            K
          </span>
          <div>
            <p className="text-gray-400">
              v1生成: レモン20% ベルガモット15% ...
            </p>
            <p className="text-[8px] text-gray-300">13:45</p>
          </div>
        </div>
        {/* User message 2 */}
        <div className="flex gap-1.5 items-start">
          <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-[7px]">
            👤
          </span>
          <div>
            <p className="text-gray-600">
              もう少し甘さを足して、ウッディ感を抑えたい。バニラっぽいニュアンスがほしい
            </p>
            <p className="text-[8px] text-gray-300">14:32</p>
          </div>
        </div>
        {/* AI response 2 */}
        <div className="flex gap-1.5 items-start">
          <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center shrink-0 text-[7px] text-white font-bold">
            K
          </span>
          <div>
            <p className="text-gray-400">
              v2生成: +バニラ +ホワイトムスク +ローズ ...
            </p>
            <p className="text-[8px] text-gray-300">14:32</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VersionCompare({
  parent,
  current,
}: {
  parent: BlendData;
  current: BlendData;
}) {
  const flavorDiffs = computeFlavorDiffs(parent.flavors, current.flavors);

  return (
    <div className="flex-1 grid grid-cols-[1fr_1fr_1.2fr] gap-3 py-3 min-h-0">
      {/* Col 1: Parent (v1) */}
      <VersionColumn
        data={parent}
        isAdopted={false}
        similarFragrances={SIMILAR_V1}
      />

      {/* Col 2: Current (v2, adopted) */}
      <VersionColumn
        data={current}
        isAdopted={true}
        flavorDiffs={flavorDiffs}
        similarFragrances={SIMILAR_V2}
      />

      {/* Col 3: Map + Story + Chat Log */}
      <div className="flex flex-col gap-3 min-h-0">
        <FragranceMap />
        <div
          className="grid grid-cols-2 gap-3 shrink-0"
          style={{ height: "40%" }}
        >
          <StoryPanel />
          <ChatLogPanel />
        </div>
      </div>
    </div>
  );
}
