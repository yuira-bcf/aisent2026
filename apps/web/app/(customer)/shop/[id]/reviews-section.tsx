// ---------------------------------------------------------------------------
// ReviewsSection – Server Component that fetches and displays recipe reviews
// ---------------------------------------------------------------------------

import { getReviewsForRecipe } from "@/lib/services/review-service";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm tracking-tight">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default async function ReviewsSection({
  recipeId,
  page = 1,
}: {
  recipeId: string;
  page?: number;
}) {
  const { items, total } = await getReviewsForRecipe(recipeId, page, 10);

  if (total === 0) {
    return <p className="text-sm text-gray-400">まだレビューはありません。</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((review) => (
        <div key={review.id} className="border border-gray-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
              {review.isVerifiedPurchase && (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">
                  購入済み
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {formatDate(review.createdAt)}
            </span>
          </div>

          {review.title && (
            <p className="text-sm font-medium text-gray-800 mb-1">
              {review.title}
            </p>
          )}

          {review.comment && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {review.comment}
            </p>
          )}

          <p className="text-xs text-gray-400 mt-2">{review.userName}</p>
        </div>
      ))}

      {total > 10 && (
        <p className="text-xs text-gray-400 text-center">
          {total}件中 {items.length}件を表示
        </p>
      )}
    </div>
  );
}
