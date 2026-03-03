import { db } from "@/lib/db";
import { creatorApplications, users } from "@kyarainnovate/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { ApplicationsManager } from "./applications-manager";

export default async function AdminCreatorsPage() {
  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: creatorApplications.id,
        userId: creatorApplications.userId,
        displayName: creatorApplications.displayName,
        creatorIdSlug: creatorApplications.creatorIdSlug,
        specialties: creatorApplications.specialties,
        status: creatorApplications.status,
        rejectionReason: creatorApplications.rejectionReason,
        createdAt: creatorApplications.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(creatorApplications)
      .innerJoin(users, eq(creatorApplications.userId, users.id))
      .orderBy(desc(creatorApplications.createdAt))
      .limit(100),
    db.select({ value: count() }).from(creatorApplications),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          クリエイター管理
        </h1>
        <p className="text-sm text-gray-400">{total}件の申請</p>
      </div>
      <ApplicationsManager initialApplications={rows} />
    </div>
  );
}
