"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

type Variant = {
  id: string;
  volume: number;
  price: number;
  effectivePrice: number;
  stock: number;
  stockStatus: StockStatus;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stockLabel: Record<StockStatus, string> = {
  IN_STOCK: "在庫あり",
  LOW_STOCK: "残りわずか",
  OUT_OF_STOCK: "在庫切れ",
};

const stockColor: Record<StockStatus, string> = {
  IN_STOCK: "text-emerald-600",
  LOW_STOCK: "text-amber-600",
  OUT_OF_STOCK: "text-red-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddToCartWithVariant({
  productId,
  variants,
}: {
  productId: string;
  variants: Variant[];
}) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const canAdd =
    selectedVariant != null &&
    selectedVariant.stockStatus !== "OUT_OF_STOCK" &&
    !loading;

  async function handleAdd() {
    if (!selectedVariantId) return;
    setLoading(true);
    try {
      await apiFetch("/api/v1/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId,
          variantId: selectedVariantId,
          quantity,
        }),
      });
      setAdded(true);
      router.refresh();
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // User can retry
    } finally {
      setLoading(false);
    }
  }

  // If no variants exist, show a simple add button (no variant selection needed)
  if (variants.length === 0) {
    return (
      <button
        type="button"
        onClick={async () => {
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
            // User can retry
          } finally {
            setLoading(false);
          }
        }}
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

  return (
    <div className="space-y-4">
      {/* Variant selection */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">容量を選択</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const isSelected = v.id === selectedVariantId;
            const isOutOfStock = v.stockStatus === "OUT_OF_STOCK";
            return (
              <button
                key={v.id}
                type="button"
                disabled={isOutOfStock}
                onClick={() => setSelectedVariantId(v.id)}
                className={`px-4 py-2 border text-sm transition ${
                  isSelected
                    ? "border-black bg-black text-white"
                    : isOutOfStock
                      ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                      : "border-gray-300 hover:border-black text-gray-700"
                }`}
              >
                <span className="font-medium">{v.volume}ml</span>
                <span className="ml-2">
                  ¥{v.effectivePrice.toLocaleString()}
                </span>
                {v.effectivePrice < v.price && (
                  <span className="ml-1 text-xs text-red-500 line-through">
                    ¥{v.price.toLocaleString()}
                  </span>
                )}
                {isOutOfStock && <span className="ml-1 text-xs">在庫切れ</span>}
              </button>
            );
          })}
        </div>
        {/* Stock status for selected variant */}
        {selectedVariant && (
          <p
            className={`text-xs mt-1.5 ${stockColor[selectedVariant.stockStatus]}`}
          >
            {stockLabel[selectedVariant.stockStatus]}
            {selectedVariant.stockStatus === "LOW_STOCK" &&
              ` (残り${selectedVariant.stock}点)`}
          </p>
        )}
      </div>

      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="qty-select" className="text-xs text-gray-500">
          数量
        </label>
        <select
          id="qty-select"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-gray-300 px-3 py-1.5 text-sm"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Add to cart button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
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
            {selectedVariant
              ? `カートに追加 - ¥${(selectedVariant.effectivePrice * quantity).toLocaleString()}`
              : "容量を選択してください"}
          </>
        )}
      </button>
    </div>
  );
}
