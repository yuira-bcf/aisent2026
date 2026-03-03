import { updateBlendName } from "@/actions/blend";
import FlavorChart from "@/components/flavor-chart";
import FragranceMap from "@/components/fragrance-map";
import StoryDisplay from "@/components/story-display";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  calculatePosition,
  findSimilarFragrances,
} from "@/lib/fragrance-map/similarity";
import { getBlendVersions } from "@/lib/services/blend-service";
import { blendRequests } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RefinementChat from "./refinement-chat";
import VersionSelector from "./version-selector";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const request = await db.query.blendRequests.findFirst({
    where: and(
      eq(blendRequests.id, id),
      eq(blendRequests.userId, session.user.id),
    ),
    with: {
      keywords: {
        with: { keyword: true },
      },
      result: {
        with: {
          flavors: {
            with: { flavor: true },
          },
        },
      },
    },
  });

  if (!request || !request.result) notFound();

  const versions = await getBlendVersions(id, session.user.id);

  const result = request.result;
  const resultFlavorList = result.flavors;

  const kwText = request.keywords.map((k) => k.keyword.word).join(" + ");

  // Build user vector for fragrance map
  const userVector: Record<string, number> = {};
  for (const f of resultFlavorList) {
    const ratio = Number.parseFloat(f.ratio);
    if (ratio > 0) {
      userVector[f.flavor.nameJa] = ratio;
    }
  }
  const userPosition = calculatePosition(userVector);
  const similarResults = findSimilarFragrances(userVector);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden px-4">
      {/* Top Bar: Version + Message Preview + Name + Actions */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 shrink-0 pt-3">
        {versions.length > 1 && (
          <>
            <VersionSelector currentId={id} versions={versions} />
            <div className="h-4 w-px bg-gray-200" />
          </>
        )}
        <p className="text-[11px] text-gray-400 truncate flex-1">{kwText}</p>
        <div className="h-4 w-px bg-gray-200" />
        <form
          action={updateBlendName}
          className="flex items-center gap-2 shrink-0"
        >
          <input type="hidden" name="id" value={request.id} />
          <input
            name="name"
            type="text"
            defaultValue={request.name ?? ""}
            placeholder="名前をつける..."
            className="w-36 border border-gray-200 px-2 py-1 text-[11px] font-medium focus:border-black focus:outline-none"
          />
        </form>
        <Link
          href={`/result/${id}/order`}
          className="btn-primary px-3 py-1.5 text-[10px]"
        >
          注文
        </Link>
        <Link href="/history" className="btn-secondary px-3 py-1.5 text-[10px]">
          履歴
        </Link>
      </div>

      {/* Main 2-Column Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 py-3 min-h-0">
        {/* Left Col: Donut Chart (top) + Fragrance Map (bottom) */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Donut Chart + Legend */}
          <div className="card p-4 shrink-0">
            <FlavorChart flavors={resultFlavorList} />
          </div>

          {/* Fragrance Map */}
          <div className="card p-3 flex-1 flex flex-col min-h-0">
            <FragranceMap
              userPosition={userPosition}
              similarFragrances={similarResults}
            />
          </div>
        </div>

        {/* Right Col: Story + AI Comment */}
        <div className="card p-4 flex flex-col min-h-0">
          {result.story && (
            <>
              <StoryDisplay story={result.story} />
              {/* AI Comment */}
              <div className="border-t border-gray-100 pt-3 mt-3 shrink-0">
                <div className="flex gap-2 items-start">
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[8px] text-white font-bold">K</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    AIがあなたのリクエストに基づいて最適な配合を提案しました。リファインチャットで調整できます。
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom: Refinement Chips + Input */}
      <div className="shrink-0 border-t border-gray-100 pt-2 pb-2">
        <RefinementChat
          blendId={id}
          currentKeywords={request.keywords.map((k) => ({
            word: k.keyword.word,
            weight: Number(k.weight),
          }))}
        />
      </div>
    </div>
  );
}
