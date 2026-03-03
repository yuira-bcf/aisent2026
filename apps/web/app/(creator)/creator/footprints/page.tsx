import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileVisitors, users } from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function FootprintsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const visitors = await db
    .select({
      id: profileVisitors.id,
      visitorName: users.name,
      visitedAt: profileVisitors.visitedAt,
    })
    .from(profileVisitors)
    .innerJoin(users, eq(profileVisitors.visitorId, users.id))
    .where(eq(profileVisitors.creatorId, session.user.id))
    .orderBy(desc(profileVisitors.visitedAt))
    .limit(50);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          あしあと
        </h1>
        <p className="text-sm text-gray-400">プロフィールを閲覧した訪問者</p>
      </div>

      {visitors.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
            footprint
          </span>
          <p className="text-sm text-gray-400">まだ訪問者はいません</p>
        </div>
      ) : (
        <div className="border border-gray-200 divide-y divide-gray-100">
          {visitors.map((visitor) => (
            <div key={visitor.id} className="px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0"
                style={{ borderRadius: "50%" }}
              >
                {visitor.visitorName.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-black truncate">
                  {visitor.visitorName}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(visitor.visitedAt).toLocaleDateString("ja-JP", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
