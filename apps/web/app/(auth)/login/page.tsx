"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">
            KYARAINNOVATE
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            あなただけの香りを、つくろう。
          </p>
        </div>
        <div className="card p-6 space-y-4">
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
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
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
              className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-40"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="text-black underline">
              新規登録
            </Link>
          </p>
          <p className="text-center text-xs text-gray-400 mt-2">
            <Link href="/forgot-password" className="text-black underline">
              パスワードをお忘れですか？
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
