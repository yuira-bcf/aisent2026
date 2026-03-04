"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ALL_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "MANUFACTURING",
  "MANUFACTURED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export function OrderDetailActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);

  async function handleUpdate() {
    if (status === currentStatus) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } catch {
      alert("ステータスの更新に失敗しました");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={updating || status === currentStatus}
        className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
      >
        {updating ? "更新中..." : "更新"}
      </button>
    </div>
  );
}
