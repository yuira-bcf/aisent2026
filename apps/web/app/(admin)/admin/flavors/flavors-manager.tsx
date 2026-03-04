"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NoteType = "TOP" | "MIDDLE" | "LAST";

type Flavor = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: NoteType;
  description: string | null;
  sortOrder: number | null;
};

const NOTE_TYPE_BADGES: Record<NoteType, string> = {
  TOP: "bg-amber-50 text-amber-700",
  MIDDLE: "bg-pink-50 text-pink-700",
  LAST: "bg-emerald-50 text-emerald-700",
};

const NOTE_TYPE_OPTIONS: { label: string; value: NoteType }[] = [
  { label: "TOP", value: "TOP" },
  { label: "MIDDLE", value: "MIDDLE" },
  { label: "LAST", value: "LAST" },
];

const EMPTY_FORM = {
  nameJa: "",
  nameEn: "",
  noteType: "TOP" as NoteType,
  description: "",
  sortOrder: 0,
};

export function FlavorsManager({
  initialFlavors,
}: { initialFlavors: Flavor[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteFilter, setNoteFilter] = useState<NoteType | "ALL">("ALL");

  const filtered = initialFlavors.filter(
    (f) => noteFilter === "ALL" || f.noteType === noteFilter,
  );

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(flavor: Flavor) {
    setEditingId(flavor.id);
    setForm({
      nameJa: flavor.nameJa,
      nameEn: flavor.nameEn,
      noteType: flavor.noteType,
      description: flavor.description ?? "",
      sortOrder: flavor.sortOrder ?? 0,
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
        nameJa: form.nameJa,
        nameEn: form.nameEn,
        noteType: form.noteType,
        description: form.description || undefined,
        sortOrder: form.sortOrder,
      };

      if (editingId) {
        await apiFetch(`/api/v1/admin/flavors/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/admin/flavors", {
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
    if (!confirm("この香料を削除しますか？")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/flavors/${id}`, { method: "DELETE" });
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
          {(["ALL", "TOP", "MIDDLE", "LAST"] as const).map((nt) => (
            <button
              type="button"
              key={nt}
              onClick={() => setNoteFilter(nt)}
              className={`px-3 py-2 text-xs font-medium transition ${
                noteFilter === nt
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {nt === "ALL" ? "ALL" : nt}
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
            {editingId ? "香料を編集" : "新しい香料を追加"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-flavorNameJa"
                className="block text-xs text-gray-500 mb-1"
              >
                名前（日本語）
              </label>
              <input
                id="input-flavorNameJa"
                type="text"
                required
                maxLength={100}
                value={form.nameJa}
                onChange={(e) => setForm({ ...form, nameJa: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="input-flavorNameEn"
                className="block text-xs text-gray-500 mb-1"
              >
                名前（英語）
              </label>
              <input
                id="input-flavorNameEn"
                type="text"
                required
                maxLength={100}
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="input-flavorNoteType"
                className="block text-xs text-gray-500 mb-1"
              >
                ノートタイプ
              </label>
              <select
                id="input-flavorNoteType"
                value={form.noteType}
                onChange={(e) =>
                  setForm({ ...form, noteType: e.target.value as NoteType })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {NOTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="input-flavorSortOrder"
                className="block text-xs text-gray-500 mb-1"
              >
                表示順
              </label>
              <input
                id="input-flavorSortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sortOrder: Number.parseInt(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="input-flavorDescription"
              className="block text-xs text-gray-500 mb-1"
            >
              説明
            </label>
            <textarea
              id="input-flavorDescription"
              maxLength={500}
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
        <div className="grid grid-cols-[1fr_1fr_0.6fr_0.4fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>名前（日本語）</span>
          <span>名前（英語）</span>
          <span>ノート</span>
          <span>順序</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当する香料が見つかりません
          </div>
        ) : (
          filtered.map((flavor) => (
            <div
              key={flavor.id}
              className="grid grid-cols-[1fr_1fr_0.6fr_0.4fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {flavor.nameJa}
              </span>
              <span className="text-gray-500 truncate">{flavor.nameEn}</span>
              <span>
                <span
                  className={`text-xs px-2 py-0.5 font-medium ${NOTE_TYPE_BADGES[flavor.noteType]}`}
                >
                  {flavor.noteType}
                </span>
              </span>
              <span className="text-xs text-gray-400">
                {flavor.sortOrder ?? 0}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(flavor)}
                  className="text-gray-400 hover:text-black transition"
                  title="編集"
                >
                  <span className="material-symbols-outlined text-base">
                    edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(flavor.id)}
                  disabled={deleting === flavor.id}
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
