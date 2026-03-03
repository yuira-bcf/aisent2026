"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "MANUFACTURING"
  | "MANUFACTURED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

type Order = {
  id: string;
  userId: string;
  user: { name: string; email: string };
  status: OrderStatus;
  totalYen: number;
  items: { id: string; quantity: number }[];
  createdAt: string | Date;
};

const STATUS_TABS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "ALL", value: "ALL" },
  { label: "PENDING", value: "PENDING" },
  { label: "CONFIRMED", value: "CONFIRMED" },
  { label: "PREPARING", value: "PREPARING" },
  { label: "MANUFACTURING", value: "MANUFACTURING" },
  { label: "MANUFACTURED", value: "MANUFACTURED" },
  { label: "SHIPPED", value: "SHIPPED" },
  { label: "DELIVERED", value: "DELIVERED" },
  { label: "CANCELLED", value: "CANCELLED" },
  { label: "RETURNED", value: "RETURNED" },
];

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
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

export function OrderManager({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered =
    statusFilter === "ALL"
      ? initialOrders
      : initialOrders.filter((order) => order.status === statusFilter);

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setUpdating(orderId);
    try {
      await apiFetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } catch {
      alert("ステータスの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-xs font-medium transition ${
              statusFilter === tab.value
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[0.8fr_1fr_0.5fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>注文ID</span>
          <span>顧客名</span>
          <span>商品数</span>
          <span>合計</span>
          <span>ステータス</span>
          <span>日付</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当する注文が見つかりません
          </div>
        ) : (
          filtered.map((order) => {
            const status = STATUS_LABELS[order.status] ?? {
              label: order.status,
              color: "bg-gray-100 text-gray-600",
            };
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );

            return (
              <div
                key={order.id}
                className="grid grid-cols-[0.8fr_1fr_0.5fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
              >
                <span className="font-mono text-xs text-gray-400 truncate">
                  {order.id.slice(0, 8)}
                </span>
                <span className="text-black truncate">{order.user.name}</span>
                <span className="text-gray-500">{itemCount}</span>
                <span className="font-medium text-black">
                  ¥{order.totalYen.toLocaleString()}
                </span>
                <span>
                  <span
                    className={`text-xs px-2 py-0.5 font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString("ja-JP")}
                </span>
                <span className="flex items-center gap-2">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-gray-400 hover:text-black transition"
                    title="詳細"
                  >
                    <span className="material-symbols-outlined text-base">
                      visibility
                    </span>
                  </Link>
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleStatusChange(
                        order.id,
                        e.target.value as OrderStatus,
                      )
                    }
                    disabled={updating === order.id}
                    className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none disabled:opacity-50"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PREPARING">PREPARING</option>
                    <option value="MANUFACTURING">MANUFACTURING</option>
                    <option value="MANUFACTURED">MANUFACTURED</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="RETURNED">RETURNED</option>
                  </select>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
