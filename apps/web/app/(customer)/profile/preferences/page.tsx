import { auth } from "@/lib/auth";
import { getPersonalizationSummary } from "@/lib/services/personalization-service";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RecalculateButton } from "./recalculate-button";

const noteTypeLabels: Record<string, string> = {
  TOP: "トップノート",
  MIDDLE: "ミドルノート",
  LAST: "ラストノート",
};

const categoryLabels: Record<string, string> = {
  floral: "フローラル",
  citrus: "シトラス",
  woody: "ウッディ",
  oriental: "オリエンタル",
  fresh: "フレッシュ",
  gourmand: "グルマン",
};

const axisLabels: Record<string, { left: string; right: string }> = {
  weight: { left: "軽い", right: "重い" },
  sweetness: { left: "ドライ", right: "スウィート" },
  temperature: { left: "クール", right: "ウォーム" },
  formality: { left: "カジュアル", right: "フォーマル" },
  intensity: { left: "さりげなく", right: "しっかり" },
};

export default async function PreferencesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const summary = await getPersonalizationSummary(session.user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          香りの好み分析
        </h1>
        <p className="text-sm text-gray-400">
          調合履歴から分析したあなたの好み
        </p>
      </div>

      {/* Top 10 Preferred Flavors */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-black mb-4">
          好みの香料 TOP {summary.topFlavors.length}
        </h2>
        {summary.topFlavors.length === 0 ? (
          <div className="border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">
              まだ調合履歴がありません
            </p>
            <Link
              href="/blend"
              className="text-sm text-black underline hover:no-underline"
            >
              最初の調合を試す
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {summary.topFlavors.map((flavor, idx) => {
              const maxWeight = summary.topFlavors[0].totalWeight;
              const barWidth =
                maxWeight > 0
                  ? Math.round((flavor.totalWeight / maxWeight) * 100)
                  : 0;
              return (
                <div
                  key={flavor.flavorId}
                  className="flex items-center gap-3 py-2"
                >
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-black truncate">
                        {flavor.nameJa}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500">
                          {noteTypeLabels[flavor.noteType] ?? flavor.noteType}
                        </span>
                        <span className="text-xs text-gray-400">
                          {flavor.totalWeight.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5">
                      <div
                        className="bg-black h-1.5 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Note Type Breakdown */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-black mb-4">ノートタイプ傾向</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["TOP", "MIDDLE", "LAST"] as const).map((noteType) => (
            <div
              key={noteType}
              className="border border-gray-100 p-4 text-center"
            >
              <p className="text-2xl font-bold text-black mb-1">
                {summary.noteTypeRatios[noteType]}%
              </p>
              <p className="text-xs text-gray-400">
                {noteTypeLabels[noteType]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Taste Onboarding Preferences */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-black">テイスト設定</h2>
          <Link
            href="/taste-onboarding"
            className="text-xs text-gray-400 hover:text-black transition"
          >
            再設定する
          </Link>
        </div>
        {summary.tastePreferences ? (
          <div className="border border-gray-100 p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">好みの系統</p>
              <p className="text-sm font-medium text-black">
                {categoryLabels[summary.tastePreferences.category] ??
                  summary.tastePreferences.category}
              </p>
            </div>
            {summary.tastePreferences.axes && (
              <div className="space-y-3">
                {Object.entries(summary.tastePreferences.axes).map(
                  ([key, value]) => {
                    const labels = axisLabels[key];
                    if (!labels) return null;
                    const pct = ((Number(value) + 50) / 100) * 100;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>{labels.left}</span>
                          <span>{labels.right}</span>
                        </div>
                        <div className="relative w-full bg-gray-100 h-2">
                          <div className="absolute top-0 left-1/2 w-px h-2 bg-gray-300" />
                          <div
                            className="absolute top-0 w-2 h-2 bg-black rounded-full -translate-x-1/2"
                            style={{ left: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">
              まだテイスト設定をしていません
            </p>
            <Link
              href="/taste-onboarding"
              className="text-sm text-black underline hover:no-underline"
            >
              設定する
            </Link>
          </div>
        )}
      </section>

      {/* Summary Stats */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-black mb-4">統計</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-black mb-1">
              {summary.topFlavors.length}
            </p>
            <p className="text-xs text-gray-400">分析済みフレーバー数</p>
          </div>
          <div className="border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-black mb-1">
              {summary.recommendedCreatorsCount}
            </p>
            <p className="text-xs text-gray-400">おすすめクリエーター数</p>
          </div>
        </div>
      </section>

      {/* Recalculate button */}
      <section className="flex items-center gap-4">
        <RecalculateButton />
        <Link
          href="/profile"
          className="text-sm text-gray-400 hover:text-black transition"
        >
          プロフィールに戻る
        </Link>
      </section>
    </div>
  );
}
