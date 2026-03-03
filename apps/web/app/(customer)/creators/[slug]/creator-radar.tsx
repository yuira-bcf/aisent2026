"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

const AXES = [
  { key: "FLORAL", label: "フローラル" },
  { key: "CITRUS", label: "シトラス" },
  { key: "WOODY", label: "ウッディ" },
  { key: "ORIENTAL", label: "オリエンタル" },
  { key: "FRESH", label: "フレッシュ" },
  { key: "GOURMAND", label: "グルマン" },
];

export default function CreatorRadar({
  specialties,
}: {
  specialties: string[];
}) {
  const data = AXES.map((axis) => ({
    subject: axis.label,
    value: specialties.includes(axis.key) ? 100 : 30,
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <Radar
            name="スタイル"
            dataKey="value"
            stroke="#000"
            fill="#000"
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
