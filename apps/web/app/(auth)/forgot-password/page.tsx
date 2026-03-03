"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiFetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("送信に失敗しました。しばらくしてからお試しください。");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-80 text-center">
          <div className="mb-6">
            <span className="material-symbols-outlined text-4xl text-black">
              mark_email_read
            </span>
          </div>
          <h1 className="text-lg font-bold text-black mb-2">
            メールを送信しました
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            入力されたメールアドレスにパスワードリセットのリンクを送信しました。メールをご確認ください。
          </p>
          <Link href="/login" className="text-sm text-black underline">
            ログインに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">
            KYARAINNOVATE
          </h1>
          <p className="text-xs text-gray-400 mt-1">パスワードリセット</p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-6 space-y-4">
          <p className="text-sm text-gray-500">
            登録されたメールアドレスを入力してください。パスワードリセットのリンクをお送りします。
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? "送信中..." : "リセットメールを送信"}
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
