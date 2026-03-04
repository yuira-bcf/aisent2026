"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
};

const ICON_MAP: Record<string, string> = {
  ORDER_CONFIRMED: "check_circle",
  ORDER_SHIPPED: "local_shipping",
  ORDER_DELIVERED: "inventory",
  ORDER_CANCELLED: "cancel",
  REVIEW_RECEIVED: "rate_review",
  ROYALTY_PAID: "payments",
  TIER_CHANGED: "military_tech",
  SYSTEM_ANNOUNCEMENT: "campaign",
  CREATOR_APPROVED: "verified",
  CREATOR_REJECTED: "block",
  RECIPE_ORDERED: "receipt_long",
};

function getIcon(type: string): string {
  return ICON_MAP[type] || "notifications";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;

  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

type Props = {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
};

export function NotificationList({ initialItems, initialUnreadCount }: Props) {
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markingAll, setMarkingAll] = useState(false);

  async function handleMarkAsRead(id: string) {
    try {
      await apiFetch(`/api/v1/notifications/${id}`, {
        method: "PUT",
      });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }

  async function handleMarkAllAsRead() {
    setMarkingAll(true);
    try {
      await apiFetch("/api/v1/notifications/read-all", {
        method: "PATCH",
      });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    } finally {
      setMarkingAll(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
          notifications_none
        </span>
        <p className="text-sm text-gray-400">通知はありません</p>
      </div>
    );
  }

  return (
    <div>
      {unreadCount > 0 && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="text-xs text-gray-500 hover:text-black transition disabled:opacity-50"
          >
            {markingAll ? "処理中..." : "すべて既読にする"}
          </button>
        </div>
      )}

      <div className="border border-gray-200 divide-y divide-gray-100">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => {
              if (!item.isRead) handleMarkAsRead(item.id);
            }}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition hover:bg-gray-50 ${
              !item.isRead ? "border-l-2 border-l-black bg-gray-50/50" : ""
            }`}
          >
            <span className="material-symbols-outlined text-lg text-gray-400 mt-0.5">
              {getIcon(item.type)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm ${!item.isRead ? "font-semibold text-black" : "text-gray-700"}`}
                >
                  {item.title}
                </span>
                {!item.isRead && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black flex-shrink-0" />
                )}
              </div>
              {item.body && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {item.body}
                </p>
              )}
              <p className="text-xs text-gray-300 mt-1">
                {relativeTime(item.createdAt)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
