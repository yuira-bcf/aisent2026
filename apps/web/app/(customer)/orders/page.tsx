import { auth } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/services/order-service";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "未決済", color: "bg-gray-100 text-gray-600" },
  PAID: { label: "決済完了", color: "bg-amber-50 text-amber-700" },
  SHIPPED: { label: "発送済", color: "bg-blue-50 text-blue-700" },
  DELIVERED: { label: "配達完了", color: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "キャンセル", color: "bg-red-50 text-red-700" },
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { items: orders } = await getOrdersForUser(session.user.id, 1, 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          注文履歴
        </h1>
        <p className="text-sm text-gray-400">{orders.length}件の注文</p>
      </div>

      {orders.length === 0 ? (
        <div className="border border-gray-200 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            receipt_long
          </span>
          <p className="text-sm text-gray-400 mb-4">注文履歴がありません</p>
          <Link
            href="/shop"
            className="inline-block px-6 py-2.5 text-sm bg-black text-white hover:bg-gray-800 transition"
          >
            ショップへ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = STATUS_LABELS[order.status] ?? {
              label: order.status,
              color: "bg-gray-100 text-gray-600",
            };
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );

            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block border border-gray-200 p-5 hover:border-gray-400 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400">
                      {order.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {itemCount}点の商品
                  </span>
                  <span className="text-sm font-bold text-black">
                    ¥{order.totalYen.toLocaleString()}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
