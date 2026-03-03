"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchCount() {
      try {
        const data = await apiFetch<{ unreadCount: number }>(
          "/api/v1/notifications/unread-count",
        );
        if (active) setCount(data.unreadCount);
      } catch {
        // silently fail
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative hover:text-white transition"
    >
      <span className="material-symbols-outlined text-lg">notifications</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
