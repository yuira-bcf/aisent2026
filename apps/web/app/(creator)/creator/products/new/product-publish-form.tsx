"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Recipe = {
  id: string;
  name: string;
};

type VariantInput = {
  volume: number;
  price: number;
  sku: string;
  stock: number;
};

type TagInput = {
  type: "season" | "scene" | "feature";
  value: string;
};

const TAG_TYPES = [
  { value: "season", label: "季節" },
  { value: "scene", label: "シーン" },
  { value: "feature", label: "特徴" },
] as const;

export function ProductPublishForm({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceYen, setPriceYen] = useState(0);
  const [recipeId, setRecipeId] = useState("");
  const [intensity, setIntensity] = useState("");

  // Variants
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantForm, setVariantForm] = useState<VariantInput>({
    volume: 30,
    price: 0,
    sku: "",
    stock: 0,
  });

  // Tags
  const [tags, setTags] = useState<TagInput[]>([]);
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagForm, setTagForm] = useState<TagInput>({
    type: "season",
    value: "",
  });

  // ------ Variant handlers ------

  function addVariant() {
    if (!variantForm.sku.trim()) return;
    setVariants([...variants, { ...variantForm }]);
    setVariantForm({ volume: 30, price: 0, sku: "", stock: 0 });
    setShowVariantForm(false);
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  // ------ Tag handlers ------

  function addTag() {
    if (!tagForm.value.trim()) return;
    // Prevent duplicates
    const exists = tags.some(
      (t) => t.type === tagForm.type && t.value === tagForm.value,
    );
    if (exists) return;
    setTags([...tags, { ...tagForm }]);
    setTagForm({ type: "season", value: "" });
    setShowTagForm(false);
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index));
  }

  // ------ Submit ------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name,
        description: description || undefined,
        priceYen,
        recipeId: recipeId || undefined,
        intensity: intensity || undefined,
      };

      if (variants.length > 0) {
        payload.variants = variants;
      }

      if (tags.length > 0) {
        payload.tags = tags;
      }

      await apiFetch("/api/v1/creator/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push("/creator/products");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "出品に失敗しました";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-black">基本情報</div>

        <div>
          <label
            htmlFor="input-name"
            className="block text-xs text-gray-500 mb-1"
          >
            商品名
          </label>
          <input
            id="input-name"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            placeholder="例: 春風のフレグランス"
          />
        </div>

        <div>
          <label
            htmlFor="input-description"
            className="block text-xs text-gray-500 mb-1"
          >
            説明
          </label>
          <textarea
            id="input-description"
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
            placeholder="商品の特徴やこだわりポイントを記入"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="input-price"
              className="block text-xs text-gray-500 mb-1"
            >
              基本価格（円）
            </label>
            <input
              id="input-price"
              type="number"
              required
              min={0}
              value={priceYen}
              onChange={(e) =>
                setPriceYen(Number.parseInt(e.target.value) || 0)
              }
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>

          {recipes.length > 0 && (
            <div>
              <label
                htmlFor="input-recipe"
                className="block text-xs text-gray-500 mb-1"
              >
                レシピ（任意）
              </label>
              <select
                id="input-recipe"
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">選択しない</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="input-intensity"
              className="block text-xs text-gray-500 mb-1"
            >
              濃度（任意）
            </label>
            <select
              id="input-intensity"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              <option value="">未設定</option>
              <option value="light">ライト</option>
              <option value="medium">ミディアム</option>
              <option value="strong">ストロング</option>
            </select>
          </div>
        </div>
      </div>

      {/* Variants section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-black">
            バリアント（容量別）
          </div>
          <button
            type="button"
            onClick={() => setShowVariantForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-black hover:text-gray-600 transition"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            追加
          </button>
        </div>

        {variants.length > 0 && (
          <div className="border border-gray-200">
            {variants.map((v, idx) => (
              <div
                key={`variant-${v.sku}`}
                className="flex items-center justify-between px-3 py-2 border-b border-gray-50 text-xs"
              >
                <span>
                  {v.volume}ml / ¥{v.price.toLocaleString()} / SKU: {v.sku} /
                  在庫: {v.stock}
                </span>
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="text-gray-400 hover:text-red-600 transition"
                >
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {showVariantForm && (
          <div className="border border-gray-200 p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="input-vVolume"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  容量（ml）
                </label>
                <input
                  id="input-vVolume"
                  type="number"
                  min={1}
                  value={variantForm.volume}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      volume: Number.parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="input-vPrice"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  価格（円）
                </label>
                <input
                  id="input-vPrice"
                  type="number"
                  min={0}
                  value={variantForm.price}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      price: Number.parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="input-vSku"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  SKU
                </label>
                <input
                  id="input-vSku"
                  type="text"
                  maxLength={50}
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm({ ...variantForm, sku: e.target.value })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="input-vStock"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  在庫
                </label>
                <input
                  id="input-vStock"
                  type="number"
                  min={0}
                  value={variantForm.stock}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      stock: Number.parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addVariant}
                className="bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => setShowVariantForm(false)}
                className="bg-gray-100 text-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tags section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-black">タグ</div>
          <button
            type="button"
            onClick={() => setShowTagForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-black hover:text-gray-600 transition"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            追加
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <span
                key={`tag-${tag.type}-${tag.value}`}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1"
              >
                <span className="text-gray-400">
                  {TAG_TYPES.find((t) => t.value === tag.type)?.label}:
                </span>
                {tag.value}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              </span>
            ))}
          </div>
        )}

        {showTagForm && (
          <div className="border border-gray-200 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="input-tagType"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  タイプ
                </label>
                <select
                  id="input-tagType"
                  value={tagForm.type}
                  onChange={(e) =>
                    setTagForm({
                      ...tagForm,
                      type: e.target.value as TagInput["type"],
                    })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                >
                  {TAG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="input-tagValue"
                  className="block text-[10px] text-gray-500 mb-1"
                >
                  値
                </label>
                <input
                  id="input-tagValue"
                  type="text"
                  maxLength={50}
                  value={tagForm.value}
                  onChange={(e) =>
                    setTagForm({ ...tagForm, value: e.target.value })
                  }
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                  placeholder="例: 春, デート, フローラル"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addTag}
                className="bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => setShowTagForm(false)}
                className="bg-gray-100 text-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "出品中..." : "出品する"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/creator/products")}
          className="bg-gray-100 text-gray-600 px-4 py-2.5 text-sm font-medium hover:bg-gray-200 transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
