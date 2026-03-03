"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

const ROLES = ["CUSTOMER", "CREATOR", "ADMIN"] as const;

export function UsersManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (filter !== "ALL" && u.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleRoleChange(userId: string, newRole: string) {
    setLoading(userId);
    try {
      await apiFetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch {
      alert("ロール変更に失敗しました");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1">
          {["ALL", ...ROLES].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                filter === r
                  ? "bg-black text-white border-black"
                  : "border-gray-300 text-gray-500 hover:border-black"
              }`}
            >
              {r === "ALL" ? "すべて" : r}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="名前・メールで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-xs flex-1 min-w-[200px] focus:outline-none focus:border-black"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">名前</th>
              <th className="px-4 py-2 font-medium">メール</th>
              <th className="px-4 py-2 font-medium">ロール</th>
              <th className="px-4 py-2 font-medium">登録日</th>
              <th className="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-amber-100 text-amber-700"
                        : user.role === "CREATOR"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={loading === user.id}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-black disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-sm">
            該当するユーザーがいません
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtered.length}件表示</p>
    </div>
  );
}
