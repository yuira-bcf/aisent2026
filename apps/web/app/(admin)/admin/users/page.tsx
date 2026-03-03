import { getUsers } from "@/lib/services/admin-service";
import { UsersManager } from "./users-manager";

export default async function AdminUsersPage() {
  const { items: users, total } = await getUsers(1, 50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ユーザー管理
        </h1>
        <p className="text-sm text-gray-400">{total}件のユーザー</p>
      </div>
      <UsersManager
        initialUsers={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
