"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewForm({
  orderId,
  recipeId,
  recipeName,
}: {
  orderId: string;
  recipeId: string;
  recipeName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("評価を選択してください");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiFetch<{ reviewId: string }>("/api/v1/reviews", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          recipeId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
        }),
      });
      router.push(`/orders/${orderId}?reviewed=true`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "レビューの投稿に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoverRating || rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Recipe name */}
      <div className="border border-gray-200 p-4">
        <p className="text-xs text-gray-400 mb-1">レシピ</p>
        <p className="text-sm font-medium text-black">{recipeName}</p>
      </div>

      {/* Star rating */}
      <div>
        <p className="text-sm font-medium text-black block mb-3">
          評価 <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 transition"
            >
              <span
                className={`material-symbols-outlined text-3xl ${
                  star <= displayRating ? "text-amber-400" : "text-gray-200"
                }`}
                style={{
                  fontVariationSettings:
                    star <= displayRating ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                star
              </span>
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-gray-400 self-center ml-2">
              {rating}/5
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label
          htmlFor="review-title"
          className="text-sm font-medium text-black block mb-2"
        >
          タイトル
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="一言で感想を..."
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>

      {/* Comment */}
      <div>
        <label
          htmlFor="review-comment"
          className="text-sm font-medium text-black block mb-2"
        >
          コメント
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="香りの印象や使い心地など..."
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {comment.length}/1000
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="w-full bg-black text-white py-3 text-sm font-medium tracking-wide hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="material-symbols-outlined text-base animate-spin">
              autorenew
            </span>
            投稿中...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base">
              rate_review
            </span>
            レビューを投稿する
          </>
        )}
      </button>
    </form>
  );
}
