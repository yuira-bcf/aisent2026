"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = [
  { id: "floral", label: "フローラル", icon: "local_florist" },
  { id: "citrus", label: "シトラス", icon: "spa" },
  { id: "woody", label: "ウッディ", icon: "park" },
  { id: "oriental", label: "オリエンタル", icon: "auto_awesome" },
  { id: "fresh", label: "フレッシュ", icon: "water_drop" },
  { id: "gourmand", label: "グルマン", icon: "cookie" },
] as const;

const AXES = [
  { id: "weight", labelLeft: "軽い", labelRight: "重い" },
  { id: "sweetness", labelLeft: "ドライ", labelRight: "スウィート" },
  { id: "temperature", labelLeft: "クール", labelRight: "ウォーム" },
  { id: "formality", labelLeft: "カジュアル", labelRight: "フォーマル" },
  { id: "intensity", labelLeft: "さりげなく", labelRight: "しっかり" },
] as const;

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [axes, setAxes] = useState<Record<string, number>>(
    Object.fromEntries(AXES.map((a) => [a.id, 0])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAxisChange = (id: string, value: number) => {
    setAxes((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/taste-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, axes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "保存に失敗しました");
        setSaving(false);
        return;
      }
      setStep(3);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // Step 1: Category selection
  if (step === 1) {
    return (
      <div>
        <div className="mb-8">
          <p className="text-xs text-gray-400 mb-1">ステップ 1 / 3</p>
          <h1 className="text-xl font-bold text-black mb-1">
            好みの香りの系統を選んでください
          </h1>
          <p className="text-sm text-gray-500">
            あなたの好みに合わせた提案に活用されます
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`border p-4 text-left transition ${
                selectedCategory === cat.id
                  ? "border-black bg-black text-white"
                  : "border-gray-200 hover:border-black"
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl mb-2 block ${
                  selectedCategory === cat.id ? "text-white" : "text-gray-400"
                }`}
              >
                {cat.icon}
              </span>
              <span className="text-sm font-medium">{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="text-sm text-gray-400 hover:text-black transition"
          >
            あとで設定する
          </Link>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!selectedCategory}
            className="bg-black text-white text-sm px-6 py-3 hover:bg-gray-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Axis sliders
  if (step === 2) {
    return (
      <div>
        <div className="mb-8">
          <p className="text-xs text-gray-400 mb-1">ステップ 2 / 3</p>
          <h1 className="text-xl font-bold text-black mb-1">
            香りの好みを調整してください
          </h1>
          <p className="text-sm text-gray-500">
            スライダーを動かして、あなたの好みのバランスを設定
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {AXES.map((axis) => (
            <div key={axis.id}>
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{axis.labelLeft}</span>
                <span>{axis.labelRight}</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                value={axes[axis.id]}
                onChange={(e) =>
                  handleAxisChange(axis.id, Number(e.target.value))
                }
                className="w-full accent-black"
              />
              <div className="text-center text-xs text-gray-400 mt-1">
                {axes[axis.id]}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-gray-400 hover:text-black transition"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white text-sm px-6 py-3 hover:bg-gray-800 transition disabled:bg-gray-500"
          >
            {saving ? "保存中..." : "保存して始める"}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Complete
  return (
    <div className="text-center py-12">
      <span className="material-symbols-outlined text-5xl text-black mb-4 block">
        check_circle
      </span>
      <h1 className="text-xl font-bold text-black mb-2">設定が完了しました</h1>
      <p className="text-sm text-gray-500 mb-8">
        あなたの好みに合わせた香りを提案します
      </p>
      <Link
        href="/home"
        className="inline-block bg-black text-white text-sm px-6 py-3 hover:bg-gray-800 transition"
      >
        ホームへ
      </Link>
    </div>
  );
}
