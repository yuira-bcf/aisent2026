"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

export default function FavoriteHeart({
  productId,
  initialFavorited,
}: {
  productId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const result = await apiFetch<{ favorited: boolean }>(
        `/api/v1/shop/products/${productId}/favorite`,
        { method: "POST" },
      );
      setFavorited(result.favorited);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={loading}
      className="p-1 transition disabled:opacity-40"
      aria-label={favorited ? "お気に入りから削除" : "お気に入りに追加"}
    >
      <span
        className={`material-symbols-outlined text-xl ${
          favorited ? "text-red-500" : "text-gray-300 hover:text-gray-500"
        }`}
        style={favorited ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        favorite
      </span>
    </button>
  );
}
