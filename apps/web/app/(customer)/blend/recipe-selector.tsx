"use client";

import { useState } from "react";

type Recipe = {
  id: string;
  name: string;
  creatorName: string;
  description: string | null;
};

export default function RecipeSelector({
  recipes,
  onSelect,
}: {
  recipes: Recipe[];
  onSelect: (recipeId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.creatorName.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    onSelect(id);
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="レシピを検索..."
        className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          レシピが見つかりません
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => handleSelect(recipe.id)}
              className={`text-left border p-4 transition ${
                selectedId === recipe.id
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <p className="text-sm font-medium text-black">{recipe.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                by {recipe.creatorName}
              </p>
              {recipe.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                  {recipe.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
