"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceYen: number;
  isActive: boolean;
  createdAt: string | Date;
};

type StatusFilter = "ALL" | "active" | "inactive";

const EMPTY_FORM = {
  name: "",
  description: "",
  priceYen: 0,
  isActive: true,
};

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

  const filtered = initialProducts.filter((p) => {
    if (statusFilter === "ALL") return true;
    return statusFilter === "active" ? p.isActive : !p.isActive;
  });

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

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {(["ALL", "active", "inactive"] as const).map((s) => (
            <button
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
              <label className="block text-xs text-gray-500 mb-1">商品名</label>
              <input
                type="text"
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                価格（円）
              </label>
              <input
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
              <label className="block text-xs text-gray-500 mb-1">
                ステータス
              </label>
              <select
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
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">説明</label>
            <textarea
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
        <div className="grid grid-cols-[1fr_0.6fr_0.5fr_0.7fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>商品名</span>
          <span>価格</span>
          <span>ステータス</span>
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
            <div
              key={product.id}
              className="grid grid-cols-[1fr_0.6fr_0.5fr_0.7fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {product.name}
              </span>
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
              <span className="text-xs text-gray-400">
                {new Date(product.createdAt).toLocaleDateString("ja-JP")}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => openEditForm(product)}
                  className="text-gray-400 hover:text-black transition"
                  title="編集"
                >
                  <span className="material-symbols-outlined text-base">
                    edit
                  </span>
                </button>
                <button
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
          ))
        )}
      </div>
    </div>
  );
}
