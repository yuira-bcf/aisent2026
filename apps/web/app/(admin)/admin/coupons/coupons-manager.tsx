"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DiscountType = "FIXED" | "PERCENT";

type Coupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderYen: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | Date;
  validUntil: string | Date | null;
  isActive: boolean;
  createdAt: string | Date;
};

type StatusFilter = "ALL" | "active" | "inactive";

const EMPTY_FORM = {
  code: "",
  discountType: "FIXED" as DiscountType,
  discountValue: 0,
  minOrderYen: 0,
  maxUses: "" as string,
  validUntil: "",
};

export function CouponsManager({
  initialCoupons,
}: { initialCoupons: Coupon[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = initialCoupons.filter((c) => {
    if (statusFilter === "ALL") return true;
    return statusFilter === "active" ? c.isActive : !c.isActive;
  });

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderYen: coupon.minOrderYen,
      maxUses: coupon.maxUses?.toString() ?? "",
      validUntil: coupon.validUntil
        ? new Date(coupon.validUntil).toISOString().split("T")[0]
        : "",
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
        code: form.code,
        discountType: form.discountType,
        discountValue: form.discountValue,
        minOrderYen: form.minOrderYen,
        maxUses: form.maxUses ? Number.parseInt(form.maxUses) : null,
        validUntil: form.validUntil || null,
      };

      if (editingId) {
        await apiFetch(`/api/v1/admin/coupons/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/admin/coupons", {
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
    if (!confirm("このクーポンを無効化しますか？")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/coupons/${id}`, { method: "DELETE" });
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
              {s === "ALL" ? "ALL" : s === "active" ? "有効" : "無効"}
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
            {editingId ? "クーポンを編集" : "新しいクーポンを追加"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                クーポンコード
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                割引タイプ
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountType: e.target.value as DiscountType,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="FIXED">定額（円）</option>
                <option value="PERCENT">割合（%）</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                割引値{form.discountType === "PERCENT" ? "（%）" : "（円）"}
              </label>
              <input
                type="number"
                required
                min={1}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountValue: Number.parseInt(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                最小注文額（円）
              </label>
              <input
                type="number"
                min={0}
                value={form.minOrderYen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minOrderYen: Number.parseInt(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                使用上限（空欄=無制限）
              </label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                有効期限（空欄=無期限）
              </label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm({ ...form, validUntil: e.target.value })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
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
        <div className="grid grid-cols-[0.8fr_0.5fr_0.5fr_0.5fr_0.7fr_0.5fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>コード</span>
          <span>タイプ</span>
          <span>割引値</span>
          <span>最小額</span>
          <span>有効期限</span>
          <span>使用数</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当するクーポンが見つかりません
          </div>
        ) : (
          filtered.map((coupon) => (
            <div
              key={coupon.id}
              className="grid grid-cols-[0.8fr_0.5fr_0.5fr_0.5fr_0.7fr_0.5fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-mono font-medium text-black truncate">
                {coupon.code}
              </span>
              <span>
                <span
                  className={`text-xs px-2 py-0.5 font-medium ${
                    coupon.discountType === "PERCENT"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {coupon.discountType === "PERCENT" ? "%" : "円"}
                </span>
              </span>
              <span className="text-black">
                {coupon.discountType === "PERCENT"
                  ? `${coupon.discountValue}%`
                  : `¥${coupon.discountValue.toLocaleString()}`}
              </span>
              <span className="text-gray-500">
                ¥{coupon.minOrderYen.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">
                {coupon.validUntil
                  ? new Date(coupon.validUntil).toLocaleDateString("ja-JP")
                  : "無期限"}
              </span>
              <span className="text-xs text-gray-500">
                {coupon.usedCount}/{coupon.maxUses ?? "∞"}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => openEditForm(coupon)}
                  className="text-gray-400 hover:text-black transition"
                  title="編集"
                >
                  <span className="material-symbols-outlined text-base">
                    edit
                  </span>
                </button>
                <button
                  onClick={() => handleDelete(coupon.id)}
                  disabled={deleting === coupon.id}
                  className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                  title="無効化"
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
