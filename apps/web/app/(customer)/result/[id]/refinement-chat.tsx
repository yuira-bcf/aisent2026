"use client";

import { type BlendState, refineBlend } from "@/actions/blend";
import { useActionState, useState } from "react";

const QUICK_CHIPS = [
  { emoji: "\uD83C\uDF6C", label: "もっと甘く" },
  { emoji: "\uD83E\uDDCA", label: "もっと爽やかに" },
  { emoji: "\uD83E\uDEB5", label: "ウッディ感を強く" },
  { emoji: "\uD83C\uDF3A", label: "フローラルを増やす" },
  { emoji: "\uD83C\uDF42", label: "秋バージョンに" },
  { emoji: "\uD83D\uDCAB", label: "もっと個性的に" },
  { emoji: "\uD83D\uDD04", label: "全く別の提案" },
] as const;

export default function RefinementChat({
  blendId,
  currentKeywords,
}: {
  blendId: string;
  currentKeywords: { word: string; weight: number }[];
}) {
  const [instruction, setInstruction] = useState("");
  const initialState: BlendState = {};
  const [state, formAction, pending] = useActionState(
    refineBlend,
    initialState,
  );

  return (
    <div>
      {/* Quick refinement chips */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setInstruction(chip.label)}
            className="px-2.5 py-1 text-[10px] border border-gray-200 rounded-full text-gray-500 hover:border-gray-400 hover:text-black transition-colors whitespace-nowrap"
          >
            {chip.emoji} {chip.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        action={(formData) => {
          formData.set("blendId", blendId);
          formData.set("instruction", instruction);
          formAction(formData);
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 card rounded p-0.5 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="この香りをどう変えたいですか？自由に伝えてください..."
                className="flex-1 text-[12px] focus:outline-none placeholder:text-gray-300"
              />
              <button
                type="submit"
                disabled={pending || !instruction.trim()}
                className="bg-black text-white rounded-full w-7 h-7 flex items-center justify-center shrink-0 hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {pending ? (
                  <span className="material-symbols-outlined text-xs animate-spin">
                    autorenew
                  </span>
                ) : (
                  <svg
                    width="12"
                    height="12"
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
          </div>
        </div>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mt-2">
            <span className="material-symbols-outlined text-base text-red-500">
              error
            </span>
            {state.error}
          </div>
        )}
      </form>
    </div>
  );
}
