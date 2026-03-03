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

type RecipeFormProps = {
  mode: "create" | "edit";
  recipeId?: string;
  initialData?: {
    name: string;
    description: string;
    concept: string;
    topRatio: number;
    middleRatio: number;
    lastRatio: number;
    price30ml?: number;
    price50ml?: number;
    flavors: RecipeFlavorEntry[];
  };
  flavors: FlavorOption[];
};

export function RecipeForm({
  mode,
  recipeId,
  initialData,
  flavors,
}: RecipeFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [concept, setConcept] = useState(initialData?.concept ?? "");
  const [topRatio, setTopRatio] = useState(initialData?.topRatio ?? 34);
  const [middleRatio, setMiddleRatio] = useState(
    initialData?.middleRatio ?? 33,
  );
  const [lastRatio, setLastRatio] = useState(initialData?.lastRatio ?? 33);
  const [price30ml, setPrice30ml] = useState<string>(
    initialData?.price30ml?.toString() ?? "",
  );
  const [price50ml, setPrice50ml] = useState<string>(
    initialData?.price50ml?.toString() ?? "",
  );
  const [recipeFlavors, setRecipeFlavors] = useState<RecipeFlavorEntry[]>(
    initialData?.flavors ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noteRatioSum = topRatio + middleRatio + lastRatio;
  const flavorRatioSum = recipeFlavors.reduce((sum, f) => sum + f.ratio, 0);

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

  function adjustNoteRatio(
    setter: (v: number) => void,
    newVal: number,
    otherA: number,
    otherB: number,
    setOtherA: (v: number) => void,
    setOtherB: (v: number) => void,
  ) {
    const clamped = Math.max(0, Math.min(100, newVal));
    setter(clamped);
    const remainder = 100 - clamped;
    const totalOther = otherA + otherB;
    if (totalOther === 0) {
      setOtherA(Math.round(remainder / 2));
      setOtherB(remainder - Math.round(remainder / 2));
    } else {
      const ratioA = otherA / totalOther;
      const newA = Math.round(remainder * ratioA);
      setOtherA(newA);
      setOtherB(remainder - newA);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (noteRatioSum !== 100) {
      setError("ノート比率の合計は100%にしてください");
      return;
    }

    if (recipeFlavors.length === 0) {
      setError("少なくとも1つのフレーバーを追加してください");
      return;
    }

    if (Math.abs(flavorRatioSum - 100) >= 0.01) {
      setError("フレーバーの配合比率の合計は100%にしてください");
      return;
    }

    setSaving(true);

    const payload = {
      name,
      description: description || undefined,
      concept: concept || undefined,
      topRatio,
      middleRatio,
      lastRatio,
      price30ml: price30ml ? Number.parseInt(price30ml, 10) : undefined,
      price50ml: price50ml ? Number.parseInt(price50ml, 10) : undefined,
      flavors: recipeFlavors,
    };

    try {
      if (mode === "create") {
        await apiFetch("/api/v1/creator/recipes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/v1/creator/recipes/${recipeId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
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
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">基本情報</h2>
        <div className="space-y-4">
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
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full resize-none"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                価格 30ml (円)
              </label>
              <input
                type="number"
                value={price30ml}
                onChange={(e) => setPrice30ml(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                価格 50ml (円)
              </label>
              <input
                type="number"
                value={price50ml}
                onChange={(e) => setPrice50ml(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                min={0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Note Ratios */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">
          ノート比率
          <span
            className={`ml-2 text-xs font-normal ${
              noteRatioSum === 100 ? "text-gray-400" : "text-red-500"
            }`}
          >
            (合計: {noteRatioSum}%)
          </span>
        </h2>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">TOP</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {topRatio}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={topRatio}
              onChange={(e) =>
                adjustNoteRatio(
                  setTopRatio,
                  Number(e.target.value),
                  middleRatio,
                  lastRatio,
                  setMiddleRatio,
                  setLastRatio,
                )
              }
              className="w-full accent-black"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">MIDDLE</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {middleRatio}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={middleRatio}
              onChange={(e) =>
                adjustNoteRatio(
                  setMiddleRatio,
                  Number(e.target.value),
                  topRatio,
                  lastRatio,
                  setTopRatio,
                  setLastRatio,
                )
              }
              className="w-full accent-black"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">LAST</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {lastRatio}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={lastRatio}
              onChange={(e) =>
                adjustNoteRatio(
                  setLastRatio,
                  Number(e.target.value),
                  topRatio,
                  middleRatio,
                  setTopRatio,
                  setMiddleRatio,
                )
              }
              className="w-full accent-black"
            />
          </div>
        </div>
      </div>

      {/* Flavor Composition */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">
          フレーバー配合
          <span
            className={`ml-2 text-xs font-normal ${
              Math.abs(flavorRatioSum - 100) < 0.01
                ? "text-gray-400"
                : "text-red-500"
            }`}
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : mode === "create" ? "作成" : "更新"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-black transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
