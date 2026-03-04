"use client";

import { type BlendState, createChatBlend } from "@/actions/blend";
import { useActionState, useState } from "react";

const SUGGESTIONS = [
  {
    emoji: "\u2600\uFE0F",
    title: "夏のデートにぴったりの香り",
    description: "爽やかで華やかなフレグランス",
  },
  {
    emoji: "\uD83C\uDF19",
    title: "落ち着いた夜のリラックス",
    description: "ウッディでミステリアスな香り",
  },
  {
    emoji: "\uD83D\uDCBC",
    title: "オフィスでの清潔感",
    description: "シトラス系のさっぱりした印象",
  },
  {
    emoji: "\uD83C\uDF81",
    title: "パートナーへの記念日ギフト",
    description: "情熱的でエレガントな特別な香り",
  },
] as const;

export default function ChatBlend({
  creatorId,
}: {
  creatorId?: string;
}) {
  const [text, setText] = useState("");
  const initialState: BlendState = {};
  const [state, formAction, pending] = useActionState(
    createChatBlend,
    initialState,
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Greeting */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-black mb-2">
            どんな香りをつくりましょう？
          </h1>
          <p className="text-sm text-gray-400">
            あなたのイメージを言葉にしてみてください。AIが最適な調合を提案します。
          </p>
        </div>

        {/* Suggestion Cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-lg mb-8">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setText(s.title)}
              className="card p-4 cursor-pointer hover:border-gray-400 transition-colors group text-left"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{s.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-black group-hover:underline">
                    {s.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {s.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="px-4 pb-6 w-full max-w-2xl mx-auto">
        <form
          action={(formData) => {
            formData.set("text", text);
            if (creatorId) formData.set("creatorId", creatorId);
            formAction(formData);
          }}
        >
          <div className="card rounded-2xl p-1 shadow-sm">
            <div className="flex items-end gap-2 p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={1}
                placeholder="どんな香りがほしいですか？イメージを自由に書いてみてください..."
                className="flex-1 resize-none text-sm leading-relaxed focus:outline-none placeholder:text-gray-300 min-h-[24px] max-h-[120px]"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center shrink-0 hover:bg-gray-800 transition-colors mb-0.5 disabled:opacity-40"
              >
                {pending ? (
                  <span className="material-symbols-outlined text-sm animate-spin">
                    autorenew
                  </span>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
            {/* Input Options */}
            <div className="flex items-center gap-1 px-3 pb-2 border-t border-gray-50 pt-2">
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm">{"\uD83C\uDF3F"}</span>{" "}
                クリエーター指定
              </button>
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm">{"\uD83C\uDF9A"}</span> ノート比率
              </button>
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm">{"\uD83D\uDCCE"}</span> 詳細設定
              </button>
            </div>
          </div>
        </form>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mt-2">
            <span className="material-symbols-outlined text-base text-red-500">
              error
            </span>
            {state.error}
          </div>
        )}

        <p className="text-center text-[10px] text-gray-300 mt-2">
          AIが季節・シーン・ムードを自動解析し、最適な香料配合を提案します
        </p>
      </div>
    </div>
  );
}
