"use client";

import Link from "next/link";
import { useState } from "react";

const sections = [
  {
    title: "メイン",
    links: [{ href: "/home", icon: "home", label: "ホーム" }],
  },
  {
    title: "調合",
    links: [
      { href: "/blend", icon: "local_florist", label: "調合リクエスト" },
      { href: "/history", icon: "history", label: "調合履歴" },
    ],
  },
  {
    title: "ショップ",
    links: [
      { href: "/shop", icon: "storefront", label: "商品一覧" },
      { href: "/cart", icon: "shopping_cart", label: "カート" },
      { href: "/orders", icon: "receipt_long", label: "注文履歴" },
      { href: "/favorites", icon: "favorite", label: "お気に入り" },
      { href: "/addresses", icon: "location_on", label: "配送先管理" },
    ],
  },
  {
    title: "クリエイター",
    links: [
      { href: "/creators", icon: "groups", label: "クリエイター一覧" },
      {
        href: "/creator-application",
        icon: "edit_note",
        label: "クリエイター申請",
      },
    ],
  },
  {
    title: "設定",
    links: [
      { href: "/profile", icon: "person", label: "プロフィール" },
      { href: "/notifications", icon: "notifications", label: "通知" },
      { href: "/notification-settings", icon: "tune", label: "通知設定" },
      { href: "/help", icon: "help", label: "ヘルプ" },
      { href: "/about", icon: "info", label: "アプリについて" },
    ],
  },
];

export default function MobileDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 md:hidden flex items-center justify-center w-12 h-12 rounded-full bg-black text-white shadow-lg"
        aria-label="メニューを開く"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-72 bg-white z-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold tracking-tight">
                KyaraInnovate
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-black transition"
                aria-label="メニューを閉じる"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {sections.map((section) => (
              <div key={section.title} className="mb-4">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {section.title}
                </h3>
                <ul>
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm text-gray-700 hover:text-black transition"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {link.icon}
                        </span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
