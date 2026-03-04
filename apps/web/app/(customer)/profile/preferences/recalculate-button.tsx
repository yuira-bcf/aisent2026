"use client";

import { recalculatePreferences } from "@/actions/personalization";
import { useTransition } from "react";

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await recalculatePreferences();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="bg-black text-white text-sm px-6 py-3 hover:bg-gray-800 transition disabled:bg-gray-500"
    >
      {isPending ? "分析中..." : "再分析"}
    </button>
  );
}
