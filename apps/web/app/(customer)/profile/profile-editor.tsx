"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

type ProfileEditorProps = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  };
};

export function ProfileEditor({ user }: ProfileEditorProps) {
  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showToast("error", "名前を入力してください");
      return;
    }
    setSavingProfile(true);
    try {
      await apiFetch("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      showToast("success", "プロフィールを保存しました");
    } catch {
      showToast("error", "プロフィールの保存に失敗しました");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast("error", "パスワードは8文字以上にしてください");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("error", "新しいパスワードが一致しません");
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/api/v1/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      showToast("success", "パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "パスワードの変更に失敗しました";
      showToast("error", message);
    } finally {
      setSavingPassword(false);
    }
  }

  const roleLabelMap: Record<string, string> = {
    CUSTOMER: "カスタマー",
    CREATOR: "クリエイター",
    ADMIN: "管理者",
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 text-sm z-50 ${
            toast.type === "success"
              ? "bg-black text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Profile Section */}
      <form onSubmit={handleProfileSave}>
        <div className="border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-black mb-4">基本情報</h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="input-profileName"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                名前
              </label>
              <input
                id="input-profileName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                required
              />
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                メールアドレス
              </p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                  ロール
                </p>
                <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700">
                  {roleLabelMap[user.role] ?? user.role}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                  登録日
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
            >
              {savingProfile ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </form>

      {/* Password Change Section */}
      <form onSubmit={handlePasswordChange}>
        <div className="border border-gray-200 p-6">
          <h2 className="text-sm font-bold text-black mb-4">パスワード変更</h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="input-currentPassword"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                現在のパスワード
              </label>
              <input
                id="input-currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-newPassword"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                新しいパスワード
              </label>
              <input
                id="input-newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-400 mt-1">8文字以上</p>
            </div>

            <div>
              <label
                htmlFor="input-confirmPassword"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                新しいパスワード（確認）
              </label>
              <input
                id="input-confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
            >
              {savingPassword ? "変更中..." : "パスワードを変更"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
