"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Flavor = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: string;
};

type FlavorNote = {
  id: string;
  flavorId: string;
  flavorNameJa: string;
  flavorNameEn: string;
  flavorNoteType: string;
  volatility: string;
  intensity: string;
  weight: string;
  temperature: string;
  memo: string | null;
};

const WEIGHT_OPTIONS = [
  { value: "light", label: "軽い" },
  { value: "medium", label: "中間" },
  { value: "heavy", label: "重い" },
];

const TEMP_OPTIONS = [
  { value: "cool", label: "クール" },
  { value: "neutral", label: "ニュートラル" },
  { value: "warm", label: "ウォーム" },
];

export function FlavorNotesManager({ flavors }: { flavors: Flavor[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<FlavorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedFlavor, setSelectedFlavor] = useState(flavors[0]?.id ?? "");
  const [volatility, setVolatility] = useState(50);
  const [intensity, setIntensity] = useState(50);
  const [weight, setWeight] = useState("medium");
  const [temperature, setTemperature] = useState("neutral");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    apiFetch<{ items: FlavorNote[] }>("/api/v1/creator/data-input/flavor-notes")
      .then((data) => setNotes(data.items))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setSelectedFlavor(flavors[0]?.id ?? "");
    setVolatility(50);
    setIntensity(50);
    setWeight("medium");
    setTemperature("neutral");
    setMemo("");
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/v1/creator/data-input/flavor-notes", {
        method: "POST",
        body: JSON.stringify({
          flavorId: selectedFlavor,
          volatility,
          intensity,
          weight,
          temperature,
          memo: memo || undefined,
        }),
      });
      const data = await apiFetch<{ items: FlavorNote[] }>(
        "/api/v1/creator/data-input/flavor-notes",
      );
      setNotes(data.items);
      resetForm();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function editNote(note: FlavorNote) {
    setSelectedFlavor(note.flavorId);
    setVolatility(Number(note.volatility));
    setIntensity(Number(note.intensity));
    setWeight(note.weight);
    setTemperature(note.temperature);
    setMemo(note.memo ?? "");
    setShowForm(true);
  }

  if (loading) {
    return <p className="text-sm text-gray-400">読み込み中...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-400">{notes.length}件登録済</p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-black text-white px-4 py-2 text-sm hover:bg-gray-800 transition"
        >
          <span className="material-symbols-outlined text-base">add</span>
          登録
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 p-4 mb-6 space-y-4"
        >
          <div>
            <label
              htmlFor="input-selectedFlavor"
              className="block text-xs text-gray-500 mb-1"
            >
              香料
            </label>
            <select
              id="input-selectedFlavor"
              value={selectedFlavor}
              onChange={(e) => setSelectedFlavor(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameJa} ({f.noteType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-volatility"
                className="text-xs text-gray-500"
              >
                揮発性
              </label>
              <span className="text-xs text-gray-400 tabular-nums">
                {volatility}
              </span>
            </div>
            <input
              id="input-volatility"
              type="range"
              min={0}
              max={100}
              value={volatility}
              onChange={(e) => setVolatility(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-intensity"
                className="text-xs text-gray-500"
              >
                香り強さ
              </label>
              <span className="text-xs text-gray-400 tabular-nums">
                {intensity}
              </span>
            </div>
            <input
              id="input-intensity"
              type="range"
              min={0}
              max={100}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-weight"
                className="block text-xs text-gray-500 mb-1"
              >
                重さ
              </label>
              <select
                id="input-weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {WEIGHT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="input-temperature"
                className="block text-xs text-gray-500 mb-1"
              >
                温度感
              </label>
              <select
                id="input-temperature"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {TEMP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="input-memo"
              className="block text-xs text-gray-500 mb-1"
            >
              メモ
            </label>
            <textarea
              id="input-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 text-sm hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-100 text-gray-600 px-4 py-2 text-sm hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="border border-gray-200">
        <div className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.5fr_0.4fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>香料</span>
          <span>揮発性</span>
          <span>強さ</span>
          <span>重さ</span>
          <span>温度感</span>
          <span />
        </div>
        {notes.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            まだ登録がありません
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.5fr_0.4fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {note.flavorNameJa}
              </span>
              <span className="text-xs text-gray-500">{note.volatility}</span>
              <span className="text-xs text-gray-500">{note.intensity}</span>
              <span className="text-xs text-gray-500">
                {WEIGHT_OPTIONS.find((o) => o.value === note.weight)?.label}
              </span>
              <span className="text-xs text-gray-500">
                {TEMP_OPTIONS.find((o) => o.value === note.temperature)?.label}
              </span>
              <button
                type="button"
                onClick={() => editNote(note)}
                className="text-gray-400 hover:text-black transition"
              >
                <span className="material-symbols-outlined text-base">
                  edit
                </span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
