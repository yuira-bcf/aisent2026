import { getMonthlySales } from "@/lib/services/royalty-service";

export default async function AdminSalesPage() {
  const monthlySalesData = await getMonthlySales(12);

  // Calculate totals
  const totalRevenue = monthlySalesData.reduce((s, m) => s + m.revenue, 0);
  const totalRoyalty = monthlySalesData.reduce((s, m) => s + m.royaltyTotal, 0);
  const totalProfit = totalRevenue - totalRoyalty;
  const totalOrders = monthlySalesData.reduce((s, m) => s + m.orderCount, 0);

  const cards = [
    {
      label: "総売上",
      value: `¥${totalRevenue.toLocaleString()}`,
      icon: "payments",
    },
    {
      label: "総ロイヤリティ",
      value: `¥${totalRoyalty.toLocaleString()}`,
      icon: "account_balance",
    },
    {
      label: "純利益",
      value: `¥${totalProfit.toLocaleString()}`,
      icon: "trending_up",
    },
    {
      label: "注文数",
      value: totalOrders.toLocaleString(),
      icon: "receipt_long",
    },
  ];

  // Prepare chart data
  const monthNames = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];
  const maxRevenue = Math.max(...monthlySalesData.map((m) => m.revenue), 1);
  const chartData = monthlySalesData.map((m) => ({
    month:
      monthNames[Number.parseInt(m.month.split("-")[1], 10) - 1] ?? m.month,
    value: Math.round((m.revenue / maxRevenue) * 100),
    amount: m.revenue,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-black">売上管理</h1>
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

      {/* Sales Chart */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
            月別売上推移
          </h3>
        </div>
        <div className="flex items-end gap-1.5 h-36">
          {chartData.map((m, i) => (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full rounded-t"
                style={{
                  height: `${m.value}%`,
                  background:
                    i === chartData.length - 1
                      ? "linear-gradient(to top,#000,#374151)"
                      : "linear-gradient(to top,#e5e7eb,#d1d5db)",
                }}
              />
              <span
                className={`text-[8px] ${i === chartData.length - 1 ? "font-bold text-black" : "text-gray-400"}`}
              >
                {m.month}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
            月別売上明細
          </h3>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 text-[9px] text-gray-400 uppercase">
            <tr>
              <th className="text-left px-4 py-2">月</th>
              <th className="text-right px-4 py-2">売上</th>
              <th className="text-right px-4 py-2">ロイヤリティ</th>
              <th className="text-right px-4 py-2">純利益</th>
              <th className="text-right px-4 py-2">注文数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monthlySalesData.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  売上データがありません
                </td>
              </tr>
            ) : (
              monthlySalesData.map((m) => {
                const profit = m.revenue - m.royaltyTotal;
                const monthLabel =
                  monthNames[Number.parseInt(m.month.split("-")[1], 10) - 1] ??
                  m.month;
                return (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">
                      {m.month} ({monthLabel})
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      ¥{m.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">
                      ¥{m.royaltyTotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">
                      ¥{profit.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {m.orderCount.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
