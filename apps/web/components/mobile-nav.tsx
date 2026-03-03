"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", icon: "home", label: "ホーム" },
  { href: "/blend", icon: "local_florist", label: "調香" },
  { href: "/shop", icon: "storefront", label: "ショップ" },
  { href: "/history", icon: "history", label: "履歴" },
  { href: "/mypage", icon: "person", label: "マイページ" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t md:hidden">
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center py-2 px-1 ${active ? "text-black" : "text-gray-400"}`}
            >
              <span className="material-symbols-outlined text-xl">
                {tab.icon}
              </span>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
