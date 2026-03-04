"use client";

import { useState } from "react";

type RecipeFlavor = {
  recipeId: string;
  flavorId: string;
  flavorNameJa: string;
  noteType: string;
  ratio: string;
};

type Recipe = {
  id: string;
  name: string;
  concept: string | null;
  scene: string | null;
  mood: string | null;
  themeId: string | null;
  topRatio: string;
  middleRatio: string;
  lastRatio: string;
  flavors: RecipeFlavor[];
};

type Evaluation = {
  recipeId: string;
  rating: number;
  adopted: boolean | null;
};

export function RecipeEvaluator({ recipes }: { recipes: Recipe[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [rating, setRating] = useState(3);

  if (recipes.length === 0) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
          menu_book
        </span>
        <p className="text-sm text-gray-400">
          評価するレシピがありません。まずレシピを作成してください。
        </p>
      </div>
    );
  }

  const recipe = recipes[currentIndex];
  if (!recipe) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
          check_circle
        </span>
        <p className="text-sm text-gray-400">
          全レシピの評価が完了しました。{evaluations.length}件評価済。
        </p>
        <div className="mt-4 space-y-2">
          {evaluations.map((ev) => {
            const r = recipes.find((rec) => rec.id === ev.recipeId);
            return (
              <div key={ev.recipeId} className="text-xs text-gray-500">
                {r?.name}: {"*".repeat(ev.rating)}{" "}
                {ev.adopted ? "(採用)" : ev.adopted === false ? "(不採用)" : ""}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const topFlavors = recipe.flavors.filter((f) => f.noteType === "TOP");
  const middleFlavors = recipe.flavors.filter((f) => f.noteType === "MIDDLE");
  const lastFlavors = recipe.flavors.filter((f) => f.noteType === "LAST");

  function evaluate(adopted: boolean) {
    setEvaluations((prev) => [
      ...prev,
      { recipeId: recipe.id, rating, adopted },
    ]);
    setRating(3);
    setCurrentIndex((prev) => prev + 1);
  }

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">
          {currentIndex + 1} / {recipes.length}
        </span>
        <span className="text-xs text-gray-400">
          {evaluations.length}件評価済
        </span>
      </div>

      {/* Recipe card */}
      <div className="border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-black mb-2">{recipe.name}</h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {recipe.scene && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
              {recipe.scene}
            </span>
          )}
          {recipe.mood && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
              {recipe.mood}
            </span>
          )}
          {recipe.themeId && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
              {recipe.themeId}
            </span>
          )}
        </div>

        {recipe.concept && (
          <p className="text-sm text-gray-500 mb-4">{recipe.concept}</p>
        )}

        {/* 3 column flavor display */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-amber-700 mb-2">
              TOP ({recipe.topRatio}%)
            </p>
            {topFlavors.length > 0 ? (
              topFlavors.map((f) => (
                <p key={f.flavorId} className="text-xs text-gray-600">
                  {f.flavorNameJa} ({f.ratio}%)
                </p>
              ))
            ) : (
              <p className="text-xs text-gray-300">-</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-pink-700 mb-2">
              MIDDLE ({recipe.middleRatio}%)
            </p>
            {middleFlavors.length > 0 ? (
              middleFlavors.map((f) => (
                <p key={f.flavorId} className="text-xs text-gray-600">
                  {f.flavorNameJa} ({f.ratio}%)
                </p>
              ))
            ) : (
              <p className="text-xs text-gray-300">-</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-700 mb-2">
              LAST ({recipe.lastRatio}%)
            </p>
            {lastFlavors.length > 0 ? (
              lastFlavors.map((f) => (
                <p key={f.flavorId} className="text-xs text-gray-600">
                  {f.flavorNameJa} ({f.ratio}%)
                </p>
              ))
            ) : (
              <p className="text-xs text-gray-300">-</p>
            )}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="border border-gray-200 p-4 mb-6">
        <p className="text-xs text-gray-500 mb-2">品質評価</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="transition"
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  star <= rating ? "text-black" : "text-gray-200"
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
          type="button"
          onClick={() => evaluate(true)}
          className="flex-1 px-4 py-3 text-sm bg-black text-white hover:bg-gray-800 transition"
        >
          採用
        </button>
        <button
          type="button"
          onClick={() => evaluate(false)}
          className="flex-1 px-4 py-3 text-sm border border-gray-200 text-gray-600 hover:border-black transition"
        >
          不採用
        </button>
      </div>
    </div>
  );
}
