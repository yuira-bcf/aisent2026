"use client";

type RecipeBreakdown = {
  recipeId: string;
  recipeName: string;
  orderCount: number;
  totalSales: number;
  royalty: number;
};

type MonthlyBreakdown = {
  month: string;
  revenue: number;
  orderCount: number;
};

type RoyaltyData = {
  totalRevenue: number;
  currentMonthRevenue: number;
  recipeCount: number;
  recipeBreakdown: RecipeBreakdown[];
  monthlyBreakdown: MonthlyBreakdown[];
};

function formatYen(amount: number) {
  return `\u00a5${amount.toLocaleString()}`;
}

export default function RoyaltyView({ data }: { data: RoyaltyData }) {
  const summaryCards = [
    {
      label: "今月の収益",
      value: formatYen(data.currentMonthRevenue),
      icon: "calendar_today",
      color: "text-emerald-500",
    },
    {
      label: "累計収益",
      value: formatYen(data.totalRevenue),
      icon: "account_balance_wallet",
      color: "text-amber-500",
    },
    {
      label: "レシピ数",
      value: data.recipeCount,
      icon: "science",
      color: "text-blue-500",
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Recipe Breakdown Table */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-black mb-3">レシピ別収益</h2>
        {data.recipeBreakdown.length === 0 ? (
          <div className="border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">まだ売上データがありません</p>
          </div>
        ) : (
          <div className="border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 text-xs text-gray-400 font-normal">
                    レシピ名
                  </th>
                  <th className="text-right p-3 text-xs text-gray-400 font-normal">
                    注文数
                  </th>
                  <th className="text-right p-3 text-xs text-gray-400 font-normal">
                    売上合計
                  </th>
                  <th className="text-right p-3 text-xs text-gray-400 font-normal">
                    ロイヤリティ(10%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recipeBreakdown.map((recipe) => (
                  <tr
                    key={recipe.recipeId}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="p-3 font-medium">{recipe.recipeName}</td>
                    <td className="p-3 text-right text-gray-500">
                      {recipe.orderCount}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatYen(recipe.totalSales)}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatYen(recipe.royalty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
