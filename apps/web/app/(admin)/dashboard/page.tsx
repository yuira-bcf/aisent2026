import { getDashboardStats } from "@/lib/services/admin-service";

const STAT_CARDS = [
  {
    key: "totalUsers",
    label: "ユーザー数",
    icon: "people",
    color: "text-indigo-500 bg-indigo-50",
  },
  {
    key: "totalOrders",
    label: "注文数",
    icon: "receipt_long",
    color: "text-amber-500 bg-amber-50",
  },
  {
    key: "totalRevenue",
    label: "売上合計",
    icon: "payments",
    color: "text-emerald-500 bg-emerald-50",
  },
  {
    key: "totalBlends",
    label: "調合数",
    icon: "science",
    color: "text-pink-500 bg-pink-50",
  },
] as const;

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: "bg-gray-400",
  CREATOR: "bg-indigo-500",
  ADMIN: "bg-amber-500",
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const maxRoleCount = Math.max(...stats.usersByRole.map((r) => r.count), 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ダッシュボード
        </h1>
        <p className="text-sm text-gray-400">管理者ダッシュボード</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {STAT_CARDS.map((card) => {
          const value =
            card.key === "totalRevenue"
              ? `¥${stats[card.key].toLocaleString()}`
              : stats[card.key].toLocaleString();

          return (
            <div key={card.key} className="border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-8 h-8 flex items-center justify-center ${card.color}`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {card.icon}
                  </span>
                </div>
                <span className="text-sm text-gray-400">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-black">{value}</p>
            </div>
          );
        })}
      </div>

      {/* Role Distribution */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-black mb-4">
          ロール分布
        </h2>
        <div className="border border-gray-200 p-6 space-y-4">
          {stats.usersByRole.map((row) => (
            <div key={row.role}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{row.role}</span>
                <span className="text-sm font-bold text-black">
                  {row.count}
                </span>
              </div>
              <div className="h-2 bg-gray-100 w-full">
                <div
                  className={`h-2 ${ROLE_COLORS[row.role] ?? "bg-gray-400"}`}
                  style={{ width: `${(row.count / maxRoleCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
