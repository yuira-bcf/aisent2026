"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CreatorSummary = {
  creatorId: string;
  displayName: string | null;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  orderCount: number;
};

export function RoyaltiesManager({
  creators,
  period,
  markPaidAction,
}: {
  creators: CreatorSummary[];
  period: string;
  markPaidAction: (creatorId: string, period: string) => Promise<number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleMarkPaid(creatorId: string) {
    setProcessingId(creatorId);
    try {
      await markPaidAction(creatorId, period);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      alert("支払い処理に失敗しました");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
          クリエーター別ロイヤリティ
        </h3>
        <span className="text-[10px] text-gray-400">対象期間: {period}</span>
      </div>
      <table className="w-full text-[11px]">
        <thead className="bg-gray-50 text-[9px] text-gray-400 uppercase">
          <tr>
            <th className="text-left px-4 py-2">クリエーター名</th>
            <th className="text-right px-4 py-2">注文数</th>
            <th className="text-right px-4 py-2">ロイヤリティ合計</th>
            <th className="text-right px-4 py-2">未払い</th>
            <th className="text-right px-4 py-2">支払済み</th>
            <th className="text-center px-4 py-2">アクション</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {creators.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-sm text-gray-400"
              >
                ロイヤリティデータがありません
              </td>
            </tr>
          ) : (
            creators.map((c) => (
              <tr key={c.creatorId} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">
                  {c.displayName ?? "不明"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {c.orderCount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  ¥{c.totalAmount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-amber-600">
                  ¥{c.pendingAmount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-600">
                  ¥{c.paidAmount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.pendingAmount > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(c.creatorId)}
                      disabled={isPending || processingId === c.creatorId}
                      className="inline-flex items-center gap-1 bg-black text-white px-3 py-1 text-[10px] font-medium hover:bg-gray-800 transition disabled:opacity-50 rounded"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        check_circle
                      </span>
                      {processingId === c.creatorId
                        ? "処理中..."
                        : "支払済みにする"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
                      <span className="material-symbols-outlined text-[14px]">
                        verified
                      </span>
                      支払完了
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
