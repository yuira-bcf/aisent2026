import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          プロフィール
        </h1>
        <p className="text-sm text-gray-400">アカウント設定</p>
      </div>
      <ProfileEditor user={user} />
    </div>
  );
}
