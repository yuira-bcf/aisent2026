import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrderDetail } from "@/lib/services/order-service";
import { products, recipeReviews } from "@kyarainnovate/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CancelButton from "./cancel-button";
import OrderTimeline from "./order-timeline";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "未決済", color: "bg-gray-100 text-gray-600" },
  PAID: { label: "決済完了", color: "bg-amber-50 text-amber-700" },
  SHIPPED: { label: "発送済", color: "bg-blue-50 text-blue-700" },
  DELIVERED: { label: "配達完了", color: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "キャンセル", color: "bg-red-50 text-red-700" },
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; reviewed?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const { success, reviewed } = await searchParams;

  const order = await getOrderDetail(id, session.user.id);
  if (!order) notFound();

  // Check if order has reviewable recipes (DELIVERED + recipe-linked product + no existing review)
  let canReview = false;
  let hasReviewed = false;
  if (order.status === "DELIVERED") {
    const productIds = order.items.map((item) => item.productId);
    if (productIds.length > 0) {
      const productRows = await db
        .select({ recipeId: products.recipeId })
        .from(products)
        .where(inArray(products.id, productIds));
      const recipeIds = productRows
        .map((p) => p.recipeId)
        .filter((rid): rid is string => rid != null);

      if (recipeIds.length > 0) {
        const existingReview = await db
          .select({ id: recipeReviews.id })
          .from(recipeReviews)
          .where(
            and(
              eq(recipeReviews.orderId, id),
              eq(recipeReviews.recipeId, recipeIds[0]),
            ),
          );
        hasReviewed = existingReview.length > 0;
        canReview = !hasReviewed;
      }
    }
  }

  const status = STATUS_LABELS[order.status] ?? {
    label: order.status,
    color: "bg-gray-100 text-gray-600",
  };

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            注文詳細
          </h1>
          <p className="text-sm text-gray-400 font-mono">
            {order.id.slice(0, 8)}
          </p>
        </div>
        <Link
          href="/orders"
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          注文一覧へ
        </Link>
      </div>

      {/* Success banner (from Stripe redirect) */}
      {success === "true" && (
        <div className="border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">
            check_circle
          </span>
          <div>
            <p className="text-sm font-medium text-emerald-800">
              ご注文ありがとうございます
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              決済が完了しました。注文の状況はこのページで確認できます。
            </p>
          </div>
        </div>
      )}

      {/* Review submitted banner */}
      {reviewed === "true" && (
        <div className="border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">
            rate_review
          </span>
          <p className="text-sm font-medium text-emerald-800">
            レビューを投稿しました。ありがとうございます！
          </p>
        </div>
      )}

      {/* Order Timeline */}
      <div className="border border-gray-200 p-6 mb-6">
        <OrderTimeline currentStatus={order.status} />
      </div>

      {/* Status + date */}
      <div className="border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">ステータス</span>
            <span className={`text-xs px-2.5 py-1 font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {new Date(order.createdAt).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="mt-4">
          <CancelButton orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {/* Review section */}
      {canReview && (
        <div className="border border-amber-200 bg-amber-50 p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600">
              rate_review
            </span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                この商品のレビューを書きませんか？
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                あなたの感想が他のお客様の参考になります
              </p>
            </div>
          </div>
          <Link
            href={`/orders/${order.id}/review`}
            className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            レビューを書く
          </Link>
        </div>
      )}
      {hasReviewed && (
        <div className="border border-gray-200 bg-gray-50 p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-500">
            check_circle
          </span>
          <p className="text-sm text-gray-600">レビュー投稿済み</p>
        </div>
      )}

      {/* Order items */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            shopping_bag
          </span>
          注文商品 ({itemCount}点)
        </h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="material-symbols-outlined text-sm text-gray-300">
                  spa
                </span>
                <span className="text-black truncate">{item.productName}</span>
                <span className="text-gray-400 flex-shrink-0">
                  x{item.quantity}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                <span className="text-gray-400">
                  @¥{item.priceYen.toLocaleString()}
                </span>
                <span className="font-medium text-black w-24 text-right">
                  ¥{(item.priceYen * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">合計</span>
          <span className="text-xl font-bold text-black">
            ¥{order.totalYen.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Shipping address */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            local_shipping
          </span>
          配送先
        </h2>
        <div className="space-y-1 text-sm text-gray-600">
          <p className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">
              person
            </span>
            {order.shippingRecipientName}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">
              mail
            </span>
            〒{order.shippingPostalCode}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">
              location_on
            </span>
            {order.shippingPrefecture}
            {order.shippingCity}
            {order.shippingAddressLine1}
            {order.shippingAddressLine2 ? ` ${order.shippingAddressLine2}` : ""}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">
              phone
            </span>
            {order.shippingPhone}
          </p>
        </div>
      </div>

      {/* Receipt button (shown for paid orders) */}
      {order.status !== "PENDING" && (
        <div className="border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-gray-400">
              receipt_long
            </span>
            領収書
          </h2>
          <a
            href={`/api/v1/receipt/${order.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 text-black hover:border-black transition"
          >
            <span className="material-symbols-outlined text-base">
              picture_as_pdf
            </span>
            領収書を表示 / ダウンロード
          </a>
        </div>
      )}
    </div>
  );
}
