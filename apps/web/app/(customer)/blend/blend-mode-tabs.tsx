"use client";

import { type ReactNode, useState } from "react";

type Tab = "form" | "chat";

export default function BlendModeTabs({
  formContent,
  chatContent,
}: {
  formContent: ReactNode;
  chatContent: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("form");

  const tabs: { value: Tab; label: string; icon: string }[] = [
    { value: "form", label: "フォーム入力", icon: "edit_note" },
    { value: "chat", label: "AIチャット", icon: "auto_awesome" },
  ];

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-8">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.value
                ? "border-black text-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "form" ? formContent : chatContent}
    </div>
  );
}
