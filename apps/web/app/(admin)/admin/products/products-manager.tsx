"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceYen: number;
  isActive: boolean;
  intensity: string | null;
  isLimited: boolean;
  manufacturingDays: number;
  giftWrappingAvailable: boolean;
  averageRating: string | null;
  reviewCount: number;
  salesCount: number;
  favoriteCount: number;
  createdAt: string | Date;
};

type Variant = {
  id: string;
  productId: string;
  volume: number;
  price: number;
  salePrice: number | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  sku: string;
  stock: number;
};

type StatusFilter = "ALL" | "active" | "inactive";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: "",
  description: "",
  priceYen: 0,
  isActive: true,
  intensity: "" as string,
  isLimited: false,
  manufacturingDays: 5,
  giftWrappingAvailable: false,
};

const EMPTY_VARIANT_FORM = {
  volume: 30,
  price: 0,
  sku: "",
  stock: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductsManager({
  initialProducts,
}: { initialProducts: Product[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Variant accordion state
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT_FORM);
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(
    null,
  );

  const filtered = initialProducts.filter((p) => {
    if (statusFilter === "ALL") return true;
    return statusFilter === "active" ? p.isActive : !p.isActive;
  });

  // ------ Product form handlers ------

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? "",
      priceYen: product.priceYen,
      isActive: product.isActive,
      intensity: product.intensity ?? "",
      isLimited: product.isLimited,
      manufacturingDays: product.manufacturingDays,
      giftWrappingAvailable: product.giftWrappingAvailable,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        priceYen: form.priceYen,
        isActive: form.isActive,
        intensity: form.intensity || undefined,
        isLimited: form.isLimited,
        manufacturingDays: form.manufacturingDays,
        giftWrappingAvailable: form.giftWrappingAvailable,
      };

      if (editingId) {
        await apiFetch(`/api/v1/admin/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/admin/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancelForm();
      router.refresh();
    } catch {
      alert(editingId ? "更新に失敗しました" : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この商品を削除しますか？")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/products/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  }

  // ------ Variant handlers ------

  const loadVariants = useCallback(async (productId: string) => {
    setLoadingVariants(true);
    try {
      const data = await apiFetch<{ variants: Variant[] }>(
        `/api/v1/admin/products/${productId}/variants`,
      );
      setVariants(data.variants);
    } catch {
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  async function toggleExpand(productId: string) {
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      setShowVariantForm(false);
      setEditingVariantId(null);
      return;
    }
    setExpandedProductId(productId);
    setShowVariantForm(false);
    setEditingVariantId(null);
    await loadVariants(productId);
  }

  function openNewVariantForm() {
    setEditingVariantId(null);
    setVariantForm(EMPTY_VARIANT_FORM);
    setShowVariantForm(true);
  }

  function openEditVariantForm(v: Variant) {
    setEditingVariantId(v.id);
    setVariantForm({
      volume: v.volume,
      price: v.price,
      sku: v.sku,
      stock: v.stock,
    });
    setShowVariantForm(true);
  }

  function cancelVariantForm() {
    setShowVariantForm(false);
    setEditingVariantId(null);
    setVariantForm(EMPTY_VARIANT_FORM);
  }

  async function handleVariantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedProductId) return;
    setSavingVariant(true);
    try {
      if (editingVariantId) {
        await apiFetch(
          `/api/v1/admin/products/${expandedProductId}/variants/${editingVariantId}`,
          { method: "PUT", body: JSON.stringify(variantForm) },
        );
      } else {
        await apiFetch(`/api/v1/admin/products/${expandedProductId}/variants`, {
          method: "POST",
          body: JSON.stringify(variantForm),
        });
      }
      cancelVariantForm();
      await loadVariants(expandedProductId);
    } catch {
      alert(
        editingVariantId
          ? "バリアント更新に失敗しました"
          : "バリアント追加に失敗しました",
      );
    } finally {
      setSavingVariant(false);
    }
  }

  async function handleVariantDelete(variantId: string) {
    if (!expandedProductId) return;
    if (!confirm("このバリアントを削除しますか？")) return;
    setDeletingVariantId(variantId);
    try {
      await apiFetch(
        `/api/v1/admin/products/${expandedProductId}/variants/${variantId}`,
        { method: "DELETE" },
      );
      await loadVariants(expandedProductId);
    } catch {
      alert("バリアント削除に失敗しました");
    } finally {
      setDeletingVariantId(null);
    }
  }

  // ------ Render ------

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {(["ALL", "active", "inactive"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "ALL" ? "ALL" : s === "active" ? "販売中" : "非公開"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="flex items-center gap-1 bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition"
        >
          <span className="material-symbols-outlined text-base">add</span>
          新規追加
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 p-4 mb-6 space-y-4"
        >
          <div className="text-sm font-medium text-black mb-2">
            {editingId ? "商品を編集" : "新しい商品を追加"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-productName"
                className="block text-xs text-gray-500 mb-1"
              >
                商品名
              </label>
              <input
                id="input-productName"
                type="text"
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="input-productPrice"
                className="block text-xs text-gray-500 mb-1"
              >
                価格（円）
              </label>
              <input
                id="input-productPrice"
                type="number"
                required
                min={0}
                value={form.priceYen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priceYen: Number.parseInt(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="input-productStatus"
                className="block text-xs text-gray-500 mb-1"
              >
                ステータス
              </label>
              <select
                id="input-productStatus"
                value={form.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.value === "active" })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="active">販売中</option>
                <option value="inactive">非公開</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="input-productIntensity"
                className="block text-xs text-gray-500 mb-1"
              >
                濃度
              </label>
              <select
                id="input-productIntensity"
                value={form.intensity}
                onChange={(e) =>
                  setForm({ ...form, intensity: e.target.value })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">未設定</option>
                <option value="light">ライト</option>
                <option value="medium">ミディアム</option>
                <option value="strong">ストロング</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="input-productManufacturingDays"
                className="block text-xs text-gray-500 mb-1"
              >
                製造日数
              </label>
              <input
                id="input-productManufacturingDays"
                type="number"
                required
                min={1}
                max={90}
                value={form.manufacturingDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    manufacturingDays: Number.parseInt(e.target.value) || 5,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label
              htmlFor="input-productIsLimited"
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                id="input-productIsLimited"
                type="checkbox"
                checked={form.isLimited}
                onChange={(e) =>
                  setForm({ ...form, isLimited: e.target.checked })
                }
                className="accent-black"
              />
              数量限定
            </label>
            <label
              htmlFor="input-productGiftWrapping"
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                id="input-productGiftWrapping"
                type="checkbox"
                checked={form.giftWrappingAvailable}
                onChange={(e) =>
                  setForm({ ...form, giftWrappingAvailable: e.target.checked })
                }
                className="accent-black"
              />
              ギフトラッピング対応
            </label>
          </div>

          <div>
            <label
              htmlFor="input-productDescription"
              className="block text-xs text-gray-500 mb-1"
            >
              説明
            </label>
            <textarea
              id="input-productDescription"
              maxLength={1000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : editingId ? "更新" : "追加"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="bg-gray-100 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[1fr_0.5fr_0.4fr_0.5fr_0.4fr_0.6fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>商品名</span>
          <span>価格</span>
          <span>ステータス</span>
          <span>評価</span>
          <span>売上</span>
          <span>登録日</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当する商品が見つかりません
          </div>
        ) : (
          filtered.map((product) => (
            <div key={product.id}>
              {/* Main row */}
              <div className="grid grid-cols-[1fr_0.5fr_0.4fr_0.5fr_0.4fr_0.6fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm hover:bg-gray-50 transition">
                <button
                  type="button"
                  onClick={() => toggleExpand(product.id)}
                  className="font-medium text-black truncate flex items-center gap-1 text-left cursor-pointer bg-transparent border-none p-0"
                >
                  <span
                    className={`material-symbols-outlined text-sm text-gray-400 transition-transform ${expandedProductId === product.id ? "rotate-90" : ""}`}
                  >
                    chevron_right
                  </span>
                  {product.name}
                  {product.isLimited && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 font-medium">
                      限定
                    </span>
                  )}
                </button>
                <span className="font-medium text-black">
                  ¥{product.priceYen.toLocaleString()}
                </span>
                <span>
                  <span
                    className={`text-xs px-2 py-0.5 font-medium ${
                      product.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {product.isActive ? "販売中" : "非公開"}
                  </span>
                </span>
                <span className="text-xs text-gray-600">
                  {product.averageRating &&
                  Number.parseFloat(product.averageRating) > 0
                    ? `★ ${product.averageRating} (${product.reviewCount})`
                    : "-"}
                </span>
                <span className="text-xs text-gray-600">
                  {product.salesCount > 0
                    ? product.salesCount.toLocaleString()
                    : "-"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(product.createdAt).toLocaleDateString("ja-JP")}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(product)}
                    className="text-gray-400 hover:text-black transition"
                    title="編集"
                  >
                    <span className="material-symbols-outlined text-base">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    disabled={deleting === product.id}
                    className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                    title="削除"
                  >
                    <span className="material-symbols-outlined text-base">
                      delete
                    </span>
                  </button>
                </span>
              </div>

              {/* Expanded: Variant panel */}
              {expandedProductId === product.id && (
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      バリアント（容量別SKU）
                    </span>
                    <button
                      type="button"
                      onClick={openNewVariantForm}
                      className="flex items-center gap-1 text-xs font-medium text-black hover:text-gray-600 transition"
                    >
                      <span className="material-symbols-outlined text-sm">
                        add
                      </span>
                      追加
                    </button>
                  </div>

                  {loadingVariants ? (
                    <div className="text-xs text-gray-400 py-2">読込中...</div>
                  ) : variants.length === 0 && !showVariantForm ? (
                    <div className="text-xs text-gray-400 py-2">
                      バリアントがありません
                    </div>
                  ) : (
                    <>
                      {variants.length > 0 && (
                        <div className="border border-gray-200 bg-white mb-3">
                          <div className="grid grid-cols-[0.5fr_0.6fr_0.8fr_0.5fr_0.4fr] gap-2 px-3 py-2 border-b border-gray-200 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                            <span>容量</span>
                            <span>価格</span>
                            <span>SKU</span>
                            <span>在庫</span>
                            <span>操作</span>
                          </div>
                          {variants.map((v) => (
                            <div
                              key={v.id}
                              className="grid grid-cols-[0.5fr_0.6fr_0.8fr_0.5fr_0.4fr] gap-2 px-3 py-2 border-b border-gray-50 items-center text-xs"
                            >
                              <span>{v.volume}ml</span>
                              <span>
                                ¥{v.price.toLocaleString()}
                                {v.salePrice != null && (
                                  <span className="ml-1 text-red-500">
                                    → ¥{v.salePrice.toLocaleString()}
                                  </span>
                                )}
                              </span>
                              <span className="text-gray-500 truncate">
                                {v.sku}
                              </span>
                              <span
                                className={
                                  v.stock <= 0 ? "text-red-500 font-medium" : ""
                                }
                              >
                                {v.stock}
                              </span>
                              <span className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditVariantForm(v)}
                                  className="text-gray-400 hover:text-black transition"
                                  title="編集"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVariantDelete(v.id)}
                                  disabled={deletingVariantId === v.id}
                                  className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                                  title="削除"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    delete
                                  </span>
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Inline variant form */}
                  {showVariantForm && (
                    <form
                      onSubmit={handleVariantSubmit}
                      className="border border-gray-200 bg-white p-3 space-y-3"
                    >
                      <div className="text-xs font-medium text-black">
                        {editingVariantId
                          ? "バリアントを編集"
                          : "バリアントを追加"}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label
                            htmlFor="input-variantVolume"
                            className="block text-[10px] text-gray-500 mb-1"
                          >
                            容量（ml）
                          </label>
                          <input
                            id="input-variantVolume"
                            type="number"
                            required
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
                            htmlFor="input-variantPrice"
                            className="block text-[10px] text-gray-500 mb-1"
                          >
                            価格（円）
                          </label>
                          <input
                            id="input-variantPrice"
                            type="number"
                            required
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
                            htmlFor="input-variantSku"
                            className="block text-[10px] text-gray-500 mb-1"
                          >
                            SKU
                          </label>
                          <input
                            id="input-variantSku"
                            type="text"
                            required
                            maxLength={50}
                            value={variantForm.sku}
                            onChange={(e) =>
                              setVariantForm({
                                ...variantForm,
                                sku: e.target.value,
                              })
                            }
                            className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-black focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="input-variantStock"
                            className="block text-[10px] text-gray-500 mb-1"
                          >
                            在庫
                          </label>
                          <input
                            id="input-variantStock"
                            type="number"
                            required
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
                          type="submit"
                          disabled={savingVariant}
                          className="bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
                        >
                          {savingVariant
                            ? "保存中..."
                            : editingVariantId
                              ? "更新"
                              : "追加"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelVariantForm}
                          className="bg-gray-100 text-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition"
                        >
                          キャンセル
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
