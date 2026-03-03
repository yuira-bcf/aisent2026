"use client";

import {
  type BlendState,
  createBlend,
  createRecipeBlend,
} from "@/actions/blend";
import { useActionState, useState } from "react";
import CreatorSelector from "./creator-selector";
import RecipeSelector from "./recipe-selector";

type Keyword = {
  id: string;
  word: string;
  category: string;
  isPreset: boolean;
};

type KeywordWeight = {
  word: string;
  weight: number;
};

type CreatorOption = {
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  tier: string;
};

type RecipeOption = {
  id: string;
  name: string;
  creatorName: string;
  description: string | null;
};

type BlendMode = "ai_only" | "styled" | "recipe";

const SEASONS = [
  { word: "春", label: "春", emoji: "\u{1F338}" },
  { word: "夏", label: "夏", emoji: "\u{2600}\u{FE0F}" },
  { word: "秋", label: "秋", emoji: "\u{1F342}" },
  { word: "冬", label: "冬", emoji: "\u{2744}\u{FE0F}" },
] as const;

const MOODS = [
  "爽やか",
  "リラックス",
  "情熱的",
  "優雅",
  "甘い",
  "ミステリアス",
] as const;

export default function BlendForm({
  presetKeywords,
  creators,
  initialCreatorSlug,
  recipes,
}: {
  presetKeywords: Keyword[];
  creators?: CreatorOption[];
  initialCreatorSlug?: string;
  recipes?: RecipeOption[];
}) {
  const initialCreator = initialCreatorSlug
    ? (creators?.find((c) => c.creatorIdSlug === initialCreatorSlug) ?? null)
    : null;
  const [mode, setMode] = useState<BlendMode>("ai_only");
  const [selected, setSelected] = useState<KeywordWeight[]>([]);
  const [topRatio, setTopRatio] = useState(35);
  const [middleRatio, setMiddleRatio] = useState(55);
  const [lastRatio, setLastRatio] = useState(10);
  const [freeWord, setFreeWord] = useState("");
  const [creatorId, setCreatorId] = useState<string | null>(
    initialCreator?.userId ?? null,
  );
  const [recipeId, setRecipeId] = useState<string | null>(null);

  const initialState: BlendState = {};
  const [state, formAction, pending] = useActionState(
    mode === "recipe" ? createRecipeBlend : createBlend,
    initialState,
  );

  function addKeyword(word: string) {
    if (selected.some((s) => s.word === word)) return;
    setSelected([...selected, { word, weight: 5 }]);
  }

  function removeKeyword(word: string) {
    setSelected(selected.filter((s) => s.word !== word));
  }

  function updateWeight(word: string, weight: number) {
    setSelected(selected.map((s) => (s.word === word ? { ...s, weight } : s)));
  }

  function addFreeWord() {
    const trimmed = freeWord.trim();
    if (!trimmed) return;
    addKeyword(trimmed);
    setFreeWord("");
  }

  const categories = ["SEASON", "PLACE", "MOOD"] as const;
  const categoryLabels: Record<string, string> = {
    SEASON: "季節",
    PLACE: "場所",
    MOOD: "気分",
  };

  const modes: { value: BlendMode; label: string; icon: string }[] = [
    { value: "ai_only", label: "AI自動調合", icon: "auto_awesome" },
    { value: "styled", label: "クリエイタースタイル", icon: "palette" },
    { value: "recipe", label: "レシピベース", icon: "menu_book" },
  ];

  return (
    <form
      action={(formData) => {
        if (mode === "recipe") {
          formData.set(
            "data",
            JSON.stringify({
              mode: "recipe",
              recipeId,
            }),
          );
        } else {
          formData.set(
            "data",
            JSON.stringify({
              mode,
              topRatio,
              middleRatio,
              lastRatio,
              keywords: selected,
              creatorId:
                mode === "styled" ? (creatorId ?? undefined) : undefined,
            }),
          );
        }
        formAction(formData);
      }}
      className="border border-gray-200 p-8 space-y-10"
    >
      {/* Mode Selector */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-base text-gray-400">
            tune
          </span>
          <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
            調合モード
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 border text-xs transition ${
                mode === m.value
                  ? "border-black bg-black text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {m.icon}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Mode */}
      {mode === "recipe" && recipes && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold tracking-widest uppercase bg-black text-white px-2 py-0.5">
              01
            </span>
            <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
              レシピを選択
            </h2>
          </div>
          <RecipeSelector
            recipes={recipes}
            onSelect={(id) => setRecipeId(id)}
          />
        </div>
      )}

      {/* Keyword + Ratio mode (ai_only / styled) */}
      {mode !== "recipe" && (
        <>
          {/* Creator Selection (styled mode only) */}
          {mode === "styled" && creators && creators.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-base text-gray-400">
                  person
                </span>
                <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
                  クリエイター（必須）
                </h2>
              </div>
              <CreatorSelector
                creators={creators}
                initialSlug={initialCreatorSlug}
                onSelect={setCreatorId}
              />
            </div>
          )}

          {/* Step 01: Keywords */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold tracking-widest uppercase bg-black text-white px-2 py-0.5">
                01
              </span>
              <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
                キーワードを入力
              </h2>
            </div>

            <div className="space-y-3">
              {categories.map((cat) => {
                const kwList = presetKeywords.filter((k) => k.category === cat);
                if (kwList.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs text-gray-400 mb-1.5">
                      {categoryLabels[cat]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {kwList.map((kw) => (
                        <button
                          key={kw.id}
                          type="button"
                          onClick={() => addKeyword(kw.word)}
                          className={`px-3 py-1.5 text-xs border transition ${
                            selected.some((s) => s.word === kw.word)
                              ? "bg-black text-white border-black"
                              : "border-gray-200 text-gray-600 hover:border-gray-400"
                          }`}
                        >
                          {kw.word}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Season Quick Select */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5">季節</p>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((s) => (
                    <button
                      key={s.word}
                      type="button"
                      onClick={() => addKeyword(s.word)}
                      className={`border rounded-full px-3 py-1 text-xs transition ${
                        selected.some((sel) => sel.word === s.word)
                          ? "bg-black text-white border-black"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Quick Select */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5">ムード</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => addKeyword(m)}
                      className={`border rounded-full px-3 py-1 text-xs transition ${
                        selected.some((sel) => sel.word === m)
                          ? "bg-black text-white border-black"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={freeWord}
                  onChange={(e) => setFreeWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFreeWord();
                    }
                  }}
                  placeholder="フリーワード"
                  className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addFreeWord}
                  className="px-4 py-2 text-sm border border-gray-200 hover:border-black transition"
                >
                  追加
                </button>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="mt-4 space-y-2">
                {selected.map((kw) => (
                  <div key={kw.word} className="flex items-center gap-3 py-2">
                    <span className="text-sm w-24 truncate">{kw.word}</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={kw.weight}
                      onChange={(e) =>
                        updateWeight(kw.word, Number(e.target.value))
                      }
                      className="flex-1 accent-black"
                    />
                    <span className="text-sm text-gray-400 w-6 text-right">
                      {kw.weight}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw.word)}
                      className="text-gray-300 hover:text-black transition"
                    >
                      <span className="material-symbols-outlined text-base">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 02: Note Ratio */}
          <div className="border-t border-gray-100 pt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold tracking-widest uppercase bg-black text-white px-2 py-0.5">
                02
              </span>
              <h2 className="text-sm font-semibold text-black uppercase tracking-wide">
                ノート比率を選択
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  label: "TOP",
                  value: topRatio,
                  set: setTopRatio,
                  min: 30,
                  max: 40,
                  dot: "bg-amber-500",
                },
                {
                  label: "MIDDLE",
                  value: middleRatio,
                  set: setMiddleRatio,
                  min: 50,
                  max: 60,
                  dot: "bg-pink-500",
                },
                {
                  label: "LAST",
                  value: lastRatio,
                  set: setLastRatio,
                  min: 10,
                  max: 15,
                  dot: "bg-emerald-500",
                },
              ].map(({ label, value, set, min, max, dot }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-medium tracking-wide w-16 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    {label}
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      set(newVal);
                      // Auto-adjust to keep sum at 100
                      if (label === "TOP") {
                        const remain = 100 - newVal - lastRatio;
                        setMiddleRatio(Math.max(50, Math.min(60, remain)));
                      } else if (label === "MIDDLE") {
                        const remain = 100 - topRatio - newVal;
                        setLastRatio(Math.max(10, Math.min(15, remain)));
                      } else {
                        const remain = 100 - topRatio - newVal;
                        setMiddleRatio(Math.max(50, Math.min(60, remain)));
                      }
                    }}
                    className="flex-1 accent-black"
                  />
                  <span className="text-sm text-gray-400 w-10 text-right">
                    {value}%
                  </span>
                </div>
              ))}

              <div className="flex justify-between text-xs text-gray-400 pt-1">
                <span>合計: {topRatio + middleRatio + lastRatio}%</span>
                {topRatio + middleRatio + lastRatio === 100 ? (
                  <span className="text-green-600">OK</span>
                ) : (
                  <span className="text-red-600">合計を100%にしてください</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {state.error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-black text-white py-3.5 text-sm font-medium tracking-wide hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <span className="material-symbols-outlined text-base animate-spin">
              autorenew
            </span>
            生成中...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base text-amber-300">
              science
            </span>
            調合を生成する
          </>
        )}
      </button>
    </form>
  );
}
