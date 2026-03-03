"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-80 text-center">
          <span className="material-symbols-outlined text-4xl text-red-500 mb-4">
            error
          </span>
          <h1 className="text-lg font-bold text-black mb-2">無効なリンク</h1>
          <p className="text-sm text-gray-500 mb-6">
            パスワードリセットのリンクが無効です。もう一度お試しください。
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-black underline"
          >
            パスワードリセットを再リクエスト
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-80 text-center">
          <div className="mb-6">
            <span className="material-symbols-outlined text-4xl text-black">
              check_circle
            </span>
          </div>
          <h1 className="text-lg font-bold text-black mb-2">
            パスワードを変更しました
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            新しいパスワードでログインしてください。
          </p>
          <Link
            href="/login"
            className="inline-block bg-black text-white px-6 py-3 text-sm font-medium hover:bg-gray-800 transition"
          >
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch {
      setError("トークンが無効または期限切れです。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">
            KYARAINNOVATE
          </h1>
          <p className="text-xs text-gray-400 mt-1">新しいパスワードを設定</p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                新しいパスワード
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                パスワード確認
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
                <span className="material-symbols-outlined text-base text-red-500">
                  error
                </span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40"
            >
              {loading ? "変更中..." : "パスワードを変更"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            <Link href="/login" className="text-black underline">
              ログインに戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
