"use client";

import { type RegisterState, register } from "@/actions/auth";
import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";

const initialState: RegisterState = {};

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  const labels: Record<number, { text: string; color: string }> = {
    0: { text: "", color: "bg-gray-200" },
    1: { text: "弱い", color: "bg-red-500" },
    2: { text: "普通", color: "bg-yellow-500" },
    3: { text: "強い", color: "bg-blue-500" },
    4: { text: "非常に強い", color: "bg-green-500" },
  };

  return { score, ...labels[score] };
}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const strength = getPasswordStrength(password);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">
            KYARAINNOVATE
          </h1>
          <p className="text-xs text-gray-400 mt-1">新規アカウント作成</p>
        </div>
        <div className="card p-6 space-y-4">
          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                お名前
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="山田 花子"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
              {state.fieldErrors?.name && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.name[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="nickname"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                ニックネーム
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                placeholder="はなこ"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                サービス内で表示される名前です
              </p>
            </div>

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
                placeholder="you@example.com"
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
              {state.fieldErrors?.email && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.email[0]}
                </p>
              )}
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
                minLength={6}
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${level <= strength.score ? strength.color : "bg-gray-200"}`}
                      />
                    ))}
                  </div>
                  {strength.text && (
                    <p className="mt-1 text-xs text-gray-500">
                      {strength.text}
                    </p>
                  )}
                </div>
              )}
              {state.fieldErrors?.password && (
                <p className="mt-1 text-xs text-red-600">
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="role"
                className="text-xs font-medium text-gray-500 block mb-1"
              >
                ロール
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
              >
                <option value="CUSTOMER">CUSTOMER — 香りを注文する</option>
                <option value="CREATOR">CREATOR — 香りを創る</option>
              </select>
            </div>

            {role === "CREATOR" && (
              <div>
                <label
                  htmlFor="creatorId"
                  className="text-xs font-medium text-gray-500 block mb-1"
                >
                  クリエーターID{" "}
                  <span className="text-[10px] text-gray-300">
                    （CREATOR選択時）
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">@</span>
                  <input
                    id="creatorId"
                    name="creatorId"
                    type="text"
                    placeholder="your_id"
                    className="flex-1 border border-gray-200 px-3 py-2.5 text-sm font-mono focus:border-black focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  英数字・アンダースコアのみ。後から変更可能です
                </p>
              </div>
            )}

            {state.error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
                <span className="material-symbols-outlined text-base text-red-500">
                  error
                </span>
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-40"
            >
              {pending ? "登録中..." : "アカウントを作成"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            既にアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-black underline">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
