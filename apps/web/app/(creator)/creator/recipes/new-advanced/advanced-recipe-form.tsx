"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type FlavorOption = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: string;
};

type RecipeFlavorEntry = {
  flavorId: string;
  ratio: number;
  noteType: string;
};

const SCENES = [
  "オフィス",
  "デート",
  "パーティー",
  "リラックス",
  "アウトドア",
  "フォーマル",
];
const MOODS = [
  "爽やか",
  "情熱的",
  "優雅",
  "甘い",
  "ミステリアス",
  "リラックス",
];
const SEASONS = ["春", "夏", "秋", "冬"];
const TIME_OF_DAY = ["朝", "昼", "夜"];
const ENERGY = ["穏やか", "活発", "バランス"];
const WORLDVIEWS = [
  "都会的",
  "自然派",
  "ヴィンテージ",
  "モダン",
  "エスニック",
  "ミニマル",
  "ロマンティック",
  "アバンギャルド",
];
const RELATIONSHIPS = ["自分用", "パートナー向け", "プレゼント用"];

function ToggleGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 text-xs transition ${
              selected.includes(opt)
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdvancedRecipeForm({ flavors }: { flavors: FlavorOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [scene, setScene] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [season, setSeason] = useState<string[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string[]>([]);
  const [worldview, setWorldview] = useState<string[]>([]);
  const [relationship, setRelationship] = useState<string[]>([]);

  const [topRatio, setTopRatio] = useState(34);
  const [middleRatio, setMiddleRatio] = useState(33);
  const [lastRatio, setLastRatio] = useState(33);
  const [recipeFlavors, setRecipeFlavors] = useState<RecipeFlavorEntry[]>([]);
  const [quality, setQuality] = useState(3);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function addFlavor() {
    const available = flavors.filter(
      (f) => !recipeFlavors.some((rf) => rf.flavorId === f.id),
    );
    if (available.length === 0) return;
    setRecipeFlavors((prev) => [
      ...prev,
      { flavorId: available[0].id, ratio: 0, noteType: available[0].noteType },
    ]);
  }

  function removeFlavor(index: number) {
    setRecipeFlavors((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFlavor(
    index: number,
    field: keyof RecipeFlavorEntry,
    value: string | number,
  ) {
    setRecipeFlavors((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    );
  }

  const flavorRatioSum = recipeFlavors.reduce((sum, f) => sum + f.ratio, 0);

  async function handleSubmit(status: "DRAFT" | "PUBLISHED") {
    setError(null);

    if (!name.trim()) {
      setError("レシピ名を入力してください");
      return;
    }
    if (recipeFlavors.length === 0) {
      setError("少なくとも1つのフレーバーを追加してください");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        concept: concept || undefined,
        scene: scene.join(",") || undefined,
        mood: mood.join(",") || undefined,
        themeId: worldview.join(",") || undefined,
        subTheme:
          [
            ...season.map((s) => `季節:${s}`),
            ...timeOfDay.map((t) => `時間:${t}`),
            ...energy.map((e) => `エネルギー:${e}`),
            ...relationship.map((r) => `関係:${r}`),
          ].join(",") || undefined,
        topRatio,
        middleRatio,
        lastRatio,
        flavors: recipeFlavors,
      };

      const result = await apiFetch<{ recipeId: string }>(
        "/api/v1/creator/recipes",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (status === "PUBLISHED") {
        await apiFetch(`/api/v1/creator/recipes/${result.recipeId}/publish`, {
          method: "POST",
        });
      }

      router.push("/creator/recipes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}

      {/* Theme selection */}
      <div className="border border-gray-200 p-6 mb-6 space-y-5">
        <h2 className="text-sm font-bold text-black">5層テーマ選択</h2>

        <ToggleGroup
          label="L2 シーン"
          options={SCENES}
          selected={scene}
          onToggle={(v) => toggle(scene, v, setScene)}
        />
        <ToggleGroup
          label="L3 ムード"
          options={MOODS}
          selected={mood}
          onToggle={(v) => toggle(mood, v, setMood)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ToggleGroup
            label="季節"
            options={SEASONS}
            selected={season}
            onToggle={(v) => toggle(season, v, setSeason)}
          />
          <ToggleGroup
            label="時間帯"
            options={TIME_OF_DAY}
            selected={timeOfDay}
            onToggle={(v) => toggle(timeOfDay, v, setTimeOfDay)}
          />
          <ToggleGroup
            label="エネルギー"
            options={ENERGY}
            selected={energy}
            onToggle={(v) => toggle(energy, v, setEnergy)}
          />
        </div>

        <ToggleGroup
          label="L4 世界観"
          options={WORLDVIEWS}
          selected={worldview}
          onToggle={(v) => toggle(worldview, v, setWorldview)}
        />
        <ToggleGroup
          label="L5 関係"
          options={RELATIONSHIPS}
          selected={relationship}
          onToggle={(v) => toggle(relationship, v, setRelationship)}
        />
      </div>

      {/* Basic info */}
      <div className="border border-gray-200 p-6 mb-6 space-y-4">
        <h2 className="text-sm font-bold text-black">基本情報</h2>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            レシピ名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            コンセプト
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={3}
            className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full resize-none"
          />
        </div>
      </div>

      {/* Note ratios */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">
          ノート比率
          <span
            className={`ml-2 text-xs font-normal ${topRatio + middleRatio + lastRatio === 100 ? "text-gray-400" : "text-red-500"}`}
          >
            (合計: {topRatio + middleRatio + lastRatio}%)
          </span>
        </h2>
        {[
          { label: "TOP", value: topRatio, setter: setTopRatio },
          { label: "MIDDLE", value: middleRatio, setter: setMiddleRatio },
          { label: "LAST", value: lastRatio, setter: setLastRatio },
        ].map((note) => (
          <div key={note.label} className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">{note.label}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {note.value}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={note.value}
              onChange={(e) => note.setter(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>
        ))}
      </div>

      {/* Flavor composition */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">
          フレーバー配合
          <span
            className={`ml-2 text-xs font-normal ${Math.abs(flavorRatioSum - 100) < 0.01 ? "text-gray-400" : "text-red-500"}`}
          >
            (合計: {flavorRatioSum.toFixed(0)}%)
          </span>
        </h2>

        <div className="space-y-2">
          {recipeFlavors.map((rf, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border border-gray-100 p-2"
            >
              <select
                value={rf.flavorId}
                onChange={(e) =>
                  updateFlavor(index, "flavorId", e.target.value)
                }
                className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none flex-1"
              >
                {flavors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nameJa} ({f.noteType})
                  </option>
                ))}
              </select>
              <select
                value={rf.noteType}
                onChange={(e) =>
                  updateFlavor(index, "noteType", e.target.value)
                }
                className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none w-24"
              >
                <option value="TOP">TOP</option>
                <option value="MIDDLE">MIDDLE</option>
                <option value="LAST">LAST</option>
              </select>
              <div className="flex items-center gap-1 w-28">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={rf.ratio}
                  onChange={(e) =>
                    updateFlavor(index, "ratio", Number(e.target.value))
                  }
                  className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none w-16"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              <button
                type="button"
                onClick={() => removeFlavor(index)}
                className="text-gray-400 hover:text-red-500 transition"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addFlavor}
          className="mt-3 text-xs text-gray-500 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          フレーバーを追加
        </button>
      </div>

      {/* Quality score */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-3">
          品質スコア（自己評価）
        </h2>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setQuality(star)}
              className="transition"
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  star <= quality ? "text-black" : "text-gray-200"
                }`}
              >
                star
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSubmit("DRAFT")}
          disabled={saving}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : "下書き保存"}
        </button>
        <button
          onClick={() => handleSubmit("PUBLISHED")}
          disabled={saving}
          className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : "公開"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-black transition"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
