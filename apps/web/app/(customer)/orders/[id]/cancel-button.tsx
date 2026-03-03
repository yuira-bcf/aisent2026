"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING"];

export default function CancelButton({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
    return null;
  }

  async function handleCancel() {
    if (
      !window.confirm(
        "この注文をキャンセルしますか？この操作は取り消せません。",
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiFetch<{ cancelled: boolean }>(
        `/api/v1/orders/${orderId}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "USER_CANCEL" }),
        },
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キャンセルに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="px-4 py-2 text-sm border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-40"
      >
        {loading ? "キャンセル中..." : "キャンセル"}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
