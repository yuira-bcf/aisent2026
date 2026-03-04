"use client";

import { apiFetch } from "@/lib/api/client";
import { useCallback, useEffect, useState } from "react";

type FlavorCard = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: string;
};

type PairResponse = {
  pair: { flavorA: FlavorCard; flavorB: FlavorCard } | null;
  allEvaluated: boolean;
};

type StatsResponse = {
  total: number;
  today: number;
};

const DAILY_GOAL = 20;

export function CompatibilitySwipe() {
  const [pair, setPair] = useState<PairResponse["pair"]>(null);
  const [allDone, setAllDone] = useState(false);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState<StatsResponse>({ total: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    try {
      const [pairData, statsData] = await Promise.all([
        apiFetch<PairResponse>("/api/v1/creator/data-input/compatibility"),
        apiFetch<StatsResponse>(
          "/api/v1/creator/data-input/compatibility?mode=stats",
        ),
      ]);
      setPair(pairData.pair);
      setAllDone(pairData.allEvaluated);
      setStats(statsData);
      setScore(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  async function handleConfirm() {
    if (!pair) return;
    setSaving(true);
    try {
      await apiFetch("/api/v1/creator/data-input/compatibility", {
        method: "POST",
        body: JSON.stringify({
          flavorAId: pair.flavorA.id,
          flavorBId: pair.flavorB.id,
          score,
        }),
      });
      await fetchNext();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    fetchNext();
  }

  const todayPct = Math.min(100, Math.round((stats.today / DAILY_GOAL) * 100));

  if (loading) {
    return <p className="text-sm text-gray-400">読み込み中...</p>;
  }

  return (
    <div>
      {/* Session progress */}
      <div className="border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">今日の入力</span>
          <span className="text-xs text-gray-400 tabular-nums">
            {stats.today} / {DAILY_GOAL}件目標
          </span>
        </div>
        <div className="h-2 bg-gray-100 w-full">
          <div
            className="h-2 bg-black transition-all"
            style={{ width: `${todayPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">累計: {stats.total}件</p>
      </div>

      {!pair ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
            check_circle
          </span>
          <p className="text-sm text-gray-400">
            {allDone
              ? "全ペアの評価が完了しています"
              : "表示できるペアがありません"}
          </p>
        </div>
      ) : (
        <>
          {/* Flavor cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-200 p-6 text-center">
              <span className="material-symbols-outlined text-2xl text-gray-400 mb-2 block">
                local_florist
              </span>
              <p className="text-sm font-medium text-black mb-1">
                {pair.flavorA.nameJa}
              </p>
              <p className="text-xs text-gray-400">{pair.flavorA.nameEn}</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
                {pair.flavorA.noteType}
              </span>
            </div>
            <div className="border border-gray-200 p-6 text-center">
              <span className="material-symbols-outlined text-2xl text-gray-400 mb-2 block">
                local_florist
              </span>
              <p className="text-sm font-medium text-black mb-1">
                {pair.flavorB.nameJa}
              </p>
              <p className="text-xs text-gray-400">{pair.flavorB.nameEn}</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
                {pair.flavorB.noteType}
              </span>
            </div>
          </div>

          {/* Score slider */}
          <div className="border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-red-400">相性悪い</span>
              <span className="text-sm font-bold text-black tabular-nums">
                {score > 0 ? "+" : ""}
                {score.toFixed(1)}
              </span>
              <span className="text-xs text-green-500">相性良い</span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={Math.round(score * 10)}
              onChange={(e) => setScore(Number(e.target.value) / 10)}
              className="w-full accent-black"
            />
            <div className="flex justify-between text-[10px] text-gray-300 mt-1">
              <span>-1.0</span>
              <span>0</span>
              <span>+1.0</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 px-4 py-3 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : "確定"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="px-4 py-3 text-sm text-gray-600 border border-gray-200 hover:border-black transition"
            >
              スキップ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
