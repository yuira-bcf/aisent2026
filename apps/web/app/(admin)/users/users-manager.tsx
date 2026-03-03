"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = "CUSTOMER" | "CREATOR" | "ADMIN";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string | Date;
};

const ROLE_FILTERS: { label: string; value: Role | "ALL" }[] = [
  { label: "ALL", value: "ALL" },
  { label: "CUSTOMER", value: "CUSTOMER" },
  { label: "CREATOR", value: "CREATOR" },
  { label: "ADMIN", value: "ADMIN" },
];

const ROLE_BADGE_COLORS: Record<Role, string> = {
  CUSTOMER: "bg-gray-100 text-gray-600",
  CREATOR: "bg-indigo-50 text-indigo-700",
  ADMIN: "bg-amber-50 text-amber-700",
};

export function UserManager({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = initialUsers.filter((user) => {
    const matchesSearch =
      !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  async function handleRoleChange(userId: string, newRole: Role) {
    setUpdating(userId);
    try {
      await apiFetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      router.refresh();
    } catch {
      alert("ロールの更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="名前またはメールで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <div className="flex gap-1">
          {ROLE_FILTERS.map((rf) => (
            <button
              key={rf.value}
              onClick={() => setRoleFilter(rf.value)}
              className={`px-3 py-2 text-xs font-medium transition ${
                roleFilter === rf.value
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>名前</span>
          <span>メール</span>
          <span>ロール</span>
          <span>登録日</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当するユーザーが見つかりません
          </div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-[1fr_1.5fr_0.7fr_0.8fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm"
            >
              <span className="font-medium text-black truncate">
                {user.name}
              </span>
              <span className="text-gray-500 truncate">{user.email}</span>
              <span>
                <span
                  className={`text-xs px-2 py-0.5 font-medium ${ROLE_BADGE_COLORS[user.role]}`}
                >
                  {user.role}
                </span>
              </span>
              <span className="text-xs text-gray-400">
                {new Date(user.createdAt).toLocaleDateString("ja-JP")}
              </span>
              <span>
                <select
                  value={user.role}
                  onChange={(e) =>
                    handleRoleChange(user.id, e.target.value as Role)
                  }
                  disabled={updating === user.id}
                  className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none disabled:opacity-50"
                >
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="CREATOR">CREATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
