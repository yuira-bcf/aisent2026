"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddToCartButton({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      await apiFetch("/api/v1/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      setAdded(true);
      router.refresh();
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // Silently handle - the user can retry
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={loading}
      className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
    >
      {loading ? (
        <>
          <span className="material-symbols-outlined text-sm animate-spin">
            autorenew
          </span>
          追加中...
        </>
      ) : added ? (
        <>
          <span className="material-symbols-outlined text-sm text-emerald-400">
            check
          </span>
          追加しました
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-sm">
            add_shopping_cart
          </span>
          カートに追加
        </>
      )}
    </button>
  );
}
