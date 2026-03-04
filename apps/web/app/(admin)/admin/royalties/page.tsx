import {
  getRoyaltySummary,
  markPeriodAsPaid,
} from "@/lib/services/royalty-service";
import { RoyaltiesManager } from "./royalties-manager";

async function markPaidAction(
  creatorId: string,
  period: string,
): Promise<number> {
  "use server";
  return markPeriodAsPaid(creatorId, period);
}

export default async function AdminRoyaltiesPage() {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { creators, totals } = await getRoyaltySummary();

  const cards = [
    {
      label: "総ロイヤリティ",
      value: `¥${totals.totalAmount.toLocaleString()}`,
      icon: "account_balance",
    },
    {
      label: "未払い",
      value: `¥${totals.pendingAmount.toLocaleString()}`,
      icon: "pending_actions",
    },
    {
      label: "支払済み",
      value: `¥${totals.paidAmount.toLocaleString()}`,
      icon: "check_circle",
    },
    {
      label: "クリエーター数",
      value: creators.length.toLocaleString(),
      icon: "groups",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-black">ロイヤリティ管理</h1>
          <p className="text-[10px] text-gray-400">
            最終更新: {new Date().toLocaleDateString("ja-JP")}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {cards.map((card) => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-xl text-gray-400">
                {card.icon}
              </span>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">
                {card.label}
              </p>
            </div>
            <p className="text-xl font-bold text-black mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Creator Royalties Table */}
      <RoyaltiesManager
        creators={creators}
        period={currentPeriod}
        markPaidAction={markPaidAction}
      />
    </div>
  );
}
