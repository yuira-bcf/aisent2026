"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVisible: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string | Date;
  userName: string | null;
  userEmail: string | null;
  recipeName: string | null;
};

type VisibilityFilter = "ALL" | "visible" | "hidden";

const STARS = [1, 2, 3, 4, 5];

export function ReviewsManager({
  initialReviews,
}: { initialReviews: Review[] }) {
  const router = useRouter();
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("ALL");
  const [toggling, setToggling] = useState<string | null>(null);

  const filtered = initialReviews.filter((r) => {
    if (visibilityFilter === "ALL") return true;
    return visibilityFilter === "visible" ? r.isVisible : !r.isVisible;
  });

  async function handleToggleVisibility(id: string, currentVisible: boolean) {
    setToggling(id);
    try {
      await apiFetch(`/api/v1/admin/reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible: !currentVisible }),
      });
      router.refresh();
    } catch {
      alert("更新に失敗しました");
    } finally {
      setToggling(null);
    }
  }

  function truncate(text: string | null, max: number) {
    if (!text) return "-";
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {(["ALL", "visible", "hidden"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setVisibilityFilter(f)}
            className={`px-3 py-2 text-xs font-medium transition ${
              visibilityFilter === f
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "ALL" ? "ALL" : f === "visible" ? "表示中" : "非表示"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[0.8fr_0.8fr_0.4fr_1fr_0.6fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>ユーザー</span>
          <span>レシピ</span>
          <span>評価</span>
          <span>コメント</span>
          <span>日付</span>
          <span>表示</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当するレビューが見つかりません
          </div>
        ) : (
          filtered.map((review) => (
            <div
              key={review.id}
              className="grid grid-cols-[0.8fr_0.8fr_0.4fr_1fr_0.6fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="text-black truncate">
                {review.userName ?? review.userEmail ?? "-"}
              </span>
              <span className="text-gray-500 truncate">
                {review.recipeName ?? "-"}
              </span>
              <span className="flex gap-0.5">
                {STARS.map((s) => (
                  <span
                    key={s}
                    className={`text-xs ${s <= review.rating ? "text-amber-400" : "text-gray-200"}`}
                  >
                    ★
                  </span>
                ))}
              </span>
              <span className="text-gray-500 text-xs truncate">
                {truncate(review.comment, 40)}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(review.createdAt).toLocaleDateString("ja-JP")}
              </span>
              <span>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleVisibility(review.id, review.isVisible)
                  }
                  disabled={toggling === review.id}
                  className={`text-xs px-2 py-1 font-medium transition disabled:opacity-50 ${
                    review.isVisible
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {review.isVisible ? "表示" : "非表示"}
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
