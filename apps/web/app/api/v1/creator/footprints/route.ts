import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { profileVisitors, users } from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";

export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const visitors = await db
    .select({
      id: profileVisitors.id,
      visitorId: profileVisitors.visitorId,
      visitorName: users.name,
      visitedAt: profileVisitors.visitedAt,
    })
    .from(profileVisitors)
    .innerJoin(users, eq(profileVisitors.visitorId, users.id))
    .where(eq(profileVisitors.creatorId, authResult.userId))
    .orderBy(desc(profileVisitors.visitedAt))
    .limit(50);

  return apiSuccess({ items: visitors, total: visitors.length });
});
