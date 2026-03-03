"use client";

import { apiFetch } from "@/lib/api/client";
import { useEffect, useState } from "react";

type Flavor = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: string;
};

type ProhibitedItem = {
  id: string;
  flavorAId: string;
  flavorAName: string;
  flavorBId: string;
  flavorBName: string;
  reason: string;
  notes: string | null;
};

const REASON_OPTIONS = [
  { value: "chemical_reaction", label: "化学反応", icon: "science" },
  { value: "odor_clash", label: "香り衝突", icon: "warning" },
  { value: "safety", label: "安全性", icon: "health_and_safety" },
  { value: "aesthetic", label: "美的不適合", icon: "palette" },
];

export function ProhibitedManager({ flavors }: { flavors: Flavor[] }) {
  const [items, setItems] = useState<ProhibitedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [flavorAId, setFlavorAId] = useState(flavors[0]?.id ?? "");
  const [flavorBId, setFlavorBId] = useState(flavors[1]?.id ?? "");
  const [reason, setReason] = useState("chemical_reaction");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchItems() {
    const data = await apiFetch<{ items: ProhibitedItem[] }>(
      "/api/v1/creator/data-input/prohibited",
    );
    setItems(data.items);
  }

  useEffect(() => {
    fetchItems().finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/v1/creator/data-input/prohibited", {
        method: "POST",
        body: JSON.stringify({
          flavorAId,
          flavorBId,
          reason,
          notes: notes || undefined,
        }),
      });
      setNotes("");
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この禁止ペアを削除しますか？")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/creator/data-input/prohibited?id=${id}`, {
        method: "DELETE",
      });
      await fetchItems();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">読み込み中...</p>;
  }

  return (
    <div>
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="border border-gray-200 p-4 mb-6 space-y-4"
      >
        {error && (
          <div className="px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">香料A</label>
            <select
              value={flavorAId}
              onChange={(e) => setFlavorAId(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameJa}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">香料B</label>
            <select
              value={flavorBId}
              onChange={(e) => setFlavorBId(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameJa}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">禁止理由</label>
          <div className="flex flex-wrap gap-2">
            {REASON_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`flex items-center gap-1 px-3 py-2 text-xs transition ${
                  reason === r.value
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {r.icon}
                </span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">備考</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-4 py-2 text-sm hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "登録中..." : "登録"}
        </button>
      </form>

      {/* Table */}
      <div className="border border-gray-200">
        <div className="grid grid-cols-[1fr_1fr_0.8fr_0.4fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>香料A</span>
          <span>香料B</span>
          <span>理由</span>
          <span />
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            まだ禁止ペアがありません
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_1fr_0.8fr_0.4fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {item.flavorAName}
              </span>
              <span className="font-medium text-black truncate">
                {item.flavorBName}
              </span>
              <span className="text-xs text-gray-500">
                {REASON_OPTIONS.find((r) => r.value === item.reason)?.label}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deleting === item.id}
                className="text-gray-400 hover:text-red-600 transition disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  delete
                </span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
