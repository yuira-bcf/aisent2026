"use client";

type MonthlyBreakdown = {
  month: string;
  revenue: number;
  orderCount: number;
  status: string;
};

type RoyaltyData = {
  totalRoyalty: number;
  pendingRoyalty: number;
  paidRoyalty: number;
  currentMonthRoyalty: number;
  monthlyBreakdown: MonthlyBreakdown[];
};

function formatYen(amount: number) {
  return `\u00a5${amount.toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  const isPending = status === "PENDING";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
        isPending
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}
    >
      {isPending ? "未払い" : "支払済"}
    </span>
  );
}

export default function RoyaltyView({ data }: { data: RoyaltyData }) {
  const summaryCards = [
    {
      label: "今月の収益",
      value: formatYen(data.currentMonthRoyalty),
      icon: "calendar_today",
      color: "text-emerald-500",
    },
    {
      label: "累計収益",
      value: formatYen(data.totalRoyalty),
      icon: "account_balance_wallet",
      color: "text-amber-500",
    },
    {
      label: "未払い",
      value: formatYen(data.pendingRoyalty),
      icon: "hourglass_top",
      color: "text-orange-500",
    },
    {
      label: "支払済",
      value: formatYen(data.paidRoyalty),
      icon: "check_circle",
      color: "text-emerald-600",
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className="border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`material-symbols-outlined text-base ${card.color}`}
              >
                {card.icon}
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-black">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <div>
        <h2 className="text-sm font-medium text-black mb-3">
          月別推移（過去6ヶ月）
        </h2>
        {data.monthlyBreakdown.length === 0 ? (
          <div className="border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">まだ月別データがありません</p>
          </div>
        ) : (
          <div className="border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 text-xs text-gray-400 font-normal">
                    月
                  </th>
                  <th className="text-right p-3 text-xs text-gray-400 font-normal">
                    注文数
                  </th>
                  <th className="text-right p-3 text-xs text-gray-400 font-normal">
                    ロイヤリティ収益
                  </th>
                  <th className="text-center p-3 text-xs text-gray-400 font-normal">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyBreakdown.map((month) => (
                  <tr
                    key={month.month}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="p-3 font-medium">{month.month}</td>
                    <td className="p-3 text-right text-gray-500">
                      {month.orderCount}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatYen(month.revenue)}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={month.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
