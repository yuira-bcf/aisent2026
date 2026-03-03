"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

export default function FavoriteButton({
  creatorUserId,
  initialFavorited,
}: {
  creatorUserId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const prev = favorited;
    setFavorited(!prev);

    try {
      const result = await apiFetch<{ favorited: boolean }>(
        "/api/v1/creator/favorites",
        {
          method: "POST",
          body: JSON.stringify({ creatorUserId }),
        },
      );
      setFavorited(result.favorited);
    } catch {
      setFavorited(prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 hover:border-black transition disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-base">
        {favorited ? "favorite" : "favorite_border"}
      </span>
      {favorited ? "お気に入り済み" : "お気に入り"}
    </button>
  );
}
