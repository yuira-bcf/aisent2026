import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBlendVersions } from "@/lib/services/blend-service";
import { blendRequests } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import VersionCompare from "./version-compare";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Fetch current blend
  const current = await db.query.blendRequests.findFirst({
    where: and(
      eq(blendRequests.id, id),
      eq(blendRequests.userId, session.user.id),
    ),
    with: {
      keywords: { with: { keyword: true } },
      result: {
        with: { flavors: { with: { flavor: true } } },
      },
    },
  });

  if (!current) notFound();
  if (!current.parentBlendId) redirect("/history");

  // Fetch parent blend
  const parent = await db.query.blendRequests.findFirst({
    where: and(
      eq(blendRequests.id, current.parentBlendId),
      eq(blendRequests.userId, session.user.id),
    ),
    with: {
      keywords: { with: { keyword: true } },
      result: {
        with: { flavors: { with: { flavor: true } } },
      },
    },
  });

  if (!parent) redirect("/history");

  // Compute version numbers
  const versions = await getBlendVersions(id, session.user.id);
  const parentVersion = versions.find((v) => v.id === parent.id)?.version ?? 1;
  const currentVersion =
    versions.find((v) => v.id === current.id)?.version ?? 2;

  // Note type to color mapping
  const noteTypeColors: Record<string, string> = (await import("@/lib/colors"))
    .NOTE_TYPE_COLORS;

  // Serialize flavor data for client component
  const parentFlavors =
    parent.result?.flavors?.map((f) => ({
      name: f.flavor.nameJa,
      percentage: Number(f.ratio),
      colorHex: noteTypeColors[f.noteType] ?? "#999",
    })) ?? [];

  const currentFlavors =
    current.result?.flavors?.map((f) => ({
      name: f.flavor.nameJa,
      percentage: Number(f.ratio),
      colorHex: noteTypeColors[f.noteType] ?? "#999",
    })) ?? [];

  // Serialize data for client component
  const parentData = {
    id: parent.id,
    name: parent.name ?? "無題",
    version: parentVersion,
    createdAt: parent.createdAt.toISOString(),
    keywords: parent.keywords.map((k) => k.keyword.word),
    topRatio: Number(parent.topRatio),
    middleRatio: Number(parent.middleRatio),
    lastRatio: Number(parent.lastRatio),
    flavors: parentFlavors,
  };

  const currentData = {
    id: current.id,
    name: current.name ?? "無題",
    version: currentVersion,
    createdAt: current.createdAt.toISOString(),
    keywords: current.keywords.map((k) => k.keyword.word),
    topRatio: Number(current.topRatio),
    middleRatio: Number(current.middleRatio),
    lastRatio: Number(current.lastRatio),
    flavors: currentFlavors,
  };

  // Extract metadata
  const seasonKw =
    current.keywords
      .map((k) => k.keyword.word)
      .find((k) => ["春", "夏", "秋", "冬"].some((s) => k.includes(s))) ?? "";
  const moodKw =
    current.keywords
      .map((k) => k.keyword.word)
      .find((k) => !["春", "夏", "秋", "冬"].some((s) => k.includes(s))) ?? "";

  const parentDate = new Date(parent.createdAt);
  const currentDate = new Date(current.createdAt);
  const fmtDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden px-4">
      {/* Top Bar */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 shrink-0">
        <a
          href="/history"
          className="btn-secondary px-2.5 py-1.5 text-[10px] rounded"
        >
          ← 履歴
        </a>
        <h2 className="text-sm font-bold text-black">{currentData.name}</h2>
        <span className="badge bg-blue-50 text-blue-600">
          v{currentVersion} 採用
        </span>
        <span className="text-[10px] text-gray-300">
          {currentVersion - 1}回調整
        </span>
        <span className="text-[10px] text-gray-300">
          {seasonKw && `${seasonKw}`}
          {moodKw && ` ・ ${moodKw}`}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-400">
          作成 {fmtDate(parentDate)} → 最終 {fmtDate(currentDate)}
        </span>
        <div className="h-4 w-px bg-gray-200" />
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-[10px] rounded"
        >
          共有
        </button>
        <a
          href={`/blend?base=${current.id}`}
          className="btn-secondary px-3 py-1.5 text-[10px] rounded"
        >
          ベースに新規
        </a>
        <a
          href={`/shop/products/${current.result?.id ?? ""}`}
          className="btn-primary px-3 py-1.5 text-[10px] rounded"
        >
          注文
        </a>
      </div>

      {/* Main Content */}
      <VersionCompare parent={parentData} current={currentData} />
    </div>
  );
}
