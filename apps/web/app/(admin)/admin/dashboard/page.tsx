import { getDashboardStats } from "@/lib/services/admin-service";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    {
      label: "今月売上",
      value: `¥${stats.totalRevenue.toLocaleString()}`,
      icon: "payments",
      trend: "+18.2%",
      trendUp: true,
      trendLabel: "前月比",
    },
    {
      label: "注文数",
      value: stats.totalOrders.toLocaleString(),
      icon: "receipt_long",
      trend: "+12.4%",
      trendUp: true,
    },
    {
      label: "ユーザー数",
      value: stats.totalUsers.toLocaleString(),
      icon: "group",
      trend: `+${Math.round(stats.totalUsers * 0.07)} 新規`,
      trendUp: true,
    },
    {
      label: "調合数",
      value: stats.totalBlends.toLocaleString(),
      icon: "science",
      trend: "+8.3%",
      trendUp: true,
    },
  ];

  // Simulated monthly sales data for bar chart
  const monthlySales = [
    { month: "9月", value: 28 },
    { month: "10月", value: 35 },
    { month: "11月", value: 48 },
    { month: "12月", value: 65 },
    { month: "1月", value: 82 },
    { month: "2月", value: 100 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-black">管理ダッシュボード</h1>
          <p className="text-[10px] text-gray-400">
            最終更新: {new Date().toLocaleDateString("ja-JP")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border border-gray-200 px-3 py-1.5 text-[11px] rounded text-gray-500">
            <option>今月</option>
            <option>先月</option>
            <option>直近3ヶ月</option>
            <option>年間</option>
          </select>
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
            <p
              className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${card.trendUp ? "text-emerald-500" : "text-red-500"}`}
            >
              <span className="material-symbols-outlined text-[12px]">
                {card.trendUp ? "trending_up" : "trending_down"}
              </span>
              {card.trend}
              {card.trendLabel ? ` ${card.trendLabel}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-4">
        {/* Sales Chart */}
        <div className="card p-5 flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
              売上推移
            </h3>
            <div className="flex gap-1">
              <button className="text-[9px] px-2 py-0.5 bg-black text-white rounded">
                月別
              </button>
              <button className="text-[9px] px-2 py-0.5 border border-gray-200 text-gray-400 rounded">
                週別
              </button>
              <button className="text-[9px] px-2 py-0.5 border border-gray-200 text-gray-400 rounded">
                日別
              </button>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-36">
            {monthlySales.map((m, i) => (
              <div
                key={m.month}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${m.value}%`,
                    background:
                      i === monthlySales.length - 1
                        ? "linear-gradient(to top,#000,#374151)"
                        : "linear-gradient(to top,#e5e7eb,#d1d5db)",
                  }}
                />
                <span
                  className={`text-[8px] ${i === monthlySales.length - 1 ? "font-bold text-black" : "text-gray-400"}`}
                >
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="w-[260px] shrink-0 space-y-3 hidden md:block">
          <div className="card p-4 border-l-4 border-l-red-400">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-red-400 text-[16px]">
                warning
              </span>
              <span className="text-[10px] font-medium text-red-600">
                在庫アラート
              </span>
            </div>
            <p className="text-[10px] text-gray-500">
              低在庫商品をご確認ください
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-400">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-amber-500 text-[16px]">
                pending_actions
              </span>
              <span className="text-[10px] font-medium text-amber-600">
                未処理
              </span>
            </div>
            <p className="text-[10px] text-gray-500">
              未発送注文やクリエーター申請をご確認ください
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-blue-400">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-blue-500 text-[16px]">
                star
              </span>
              <span className="text-[10px] font-medium text-blue-600">
                レビュー
              </span>
            </div>
            <p className="text-[10px] text-gray-500">
              未承認レビューをご確認ください
            </p>
          </div>
        </div>
      </div>

      {/* Role table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">
            ロール別ユーザー
          </h3>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 text-[9px] text-gray-400 uppercase">
            <tr>
              <th className="text-left px-4 py-2">ロール</th>
              <th className="text-right px-4 py-2">人数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats.usersByRole.map((row) => (
              <tr key={row.role} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">{row.role}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {row.count.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
