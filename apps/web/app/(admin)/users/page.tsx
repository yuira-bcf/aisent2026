import { getUsers } from "@/lib/services/admin-service";
import { UserManager } from "./users-manager";

export default async function AdminUsersPage() {
  const { items: users } = await getUsers(1, 50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ユーザー管理
        </h1>
        <p className="text-sm text-gray-400">{users.length}人のユーザー</p>
      </div>
      <UserManager initialUsers={users} />
    </div>
  );
}
