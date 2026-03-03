import { db } from "@/lib/db";
import { orderItems, orders, users } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailActions } from "./order-detail-actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });

  if (!order) notFound();

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, order.userId));

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "未決済", color: "bg-gray-100 text-gray-600" },
    CONFIRMED: { label: "決済完了", color: "bg-amber-50 text-amber-700" },
    PREPARING: { label: "準備中", color: "bg-yellow-50 text-yellow-700" },
    MANUFACTURING: { label: "製造中", color: "bg-orange-50 text-orange-700" },
    MANUFACTURED: { label: "製造完了", color: "bg-teal-50 text-teal-700" },
    SHIPPED: { label: "発送済", color: "bg-blue-50 text-blue-700" },
    DELIVERED: { label: "配達完了", color: "bg-emerald-50 text-emerald-700" },
    CANCELLED: { label: "キャンセル", color: "bg-red-50 text-red-700" },
    RETURNED: { label: "返品", color: "bg-rose-50 text-rose-700" },
  };

  const status = STATUS_LABELS[order.status] ?? {
    label: order.status,
    color: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back link */}
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-black transition mb-6"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        注文管理に戻る
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black">
          注文詳細
        </h1>
        <span className="font-mono text-sm text-gray-400">
          {order.id.slice(0, 8)}...
        </span>
        <span className={`text-xs px-2 py-0.5 font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Customer info card */}
      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-black mb-3">顧客情報</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-xs text-gray-400">名前</span>
            <p className="text-black">{user?.name ?? "-"}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">メール</span>
            <p className="text-black">{user?.email ?? "-"}</p>
          </div>
        </div>
      </div>

      {/* Order items table */}
      <div className="border border-gray-200 mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            商品
          </h2>
        </div>
        <div className="grid grid-cols-[1fr_0.4fr_0.5fr_0.5fr] gap-2 px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-400 uppercase">
          <span>商品名</span>
          <span>数量</span>
          <span>単価</span>
          <span>小計</span>
        </div>
        {order.items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_0.4fr_0.5fr_0.5fr] gap-2 px-4 py-3 border-b border-gray-100 text-sm"
          >
            <span className="text-black">{item.productName}</span>
            <span className="text-gray-500">{item.quantity}</span>
            <span className="text-gray-500">
              ¥{item.priceYen.toLocaleString()}
            </span>
            <span className="font-medium text-black">
              ¥{(item.priceYen * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 text-sm">
          {order.discountYen > 0 && (
            <span className="text-gray-500">
              割引: -¥{order.discountYen.toLocaleString()}
            </span>
          )}
          <span className="ml-auto font-bold text-black">
            合計: ¥{order.totalYen.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Shipping address card */}
      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-medium text-black mb-3">配送先</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p className="text-black font-medium">
            {order.shippingRecipientName}
          </p>
          <p>〒{order.shippingPostalCode}</p>
          <p>
            {order.shippingPrefecture}
            {order.shippingCity}
            {order.shippingAddressLine1}
          </p>
          {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
          <p>TEL: {order.shippingPhone}</p>
        </div>
      </div>

      {/* Status change */}
      <div className="border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-black mb-3">ステータス変更</h2>
        <OrderDetailActions orderId={order.id} currentStatus={order.status} />
      </div>
    </div>
  );
}
