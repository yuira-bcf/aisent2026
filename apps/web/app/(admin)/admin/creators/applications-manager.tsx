"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

type Application = {
  id: string;
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  specialties: string[];
  status: ApplicationStatus;
  rejectionReason: string | null;
  createdAt: string | Date;
  userName: string | null;
  userEmail: string;
};

const STATUS_TABS: { label: string; value: ApplicationStatus | "ALL" }[] = [
  { label: "ALL", value: "ALL" },
  { label: "PENDING", value: "PENDING" },
  { label: "APPROVED", value: "APPROVED" },
  { label: "REJECTED", value: "REJECTED" },
];

const STATUS_LABELS: Record<
  ApplicationStatus,
  { label: string; color: string }
> = {
  PENDING: { label: "審査中", color: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "承認済", color: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "却下", color: "bg-red-50 text-red-700" },
};

export function ApplicationsManager({
  initialApplications,
}: {
  initialApplications: Application[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "ALL">(
    "PENDING",
  );
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const filtered =
    statusFilter === "ALL"
      ? initialApplications
      : initialApplications.filter((app) => app.status === statusFilter);

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      await apiFetch(`/api/v1/admin/creators/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ approve: true }),
      });
      router.refresh();
    } catch {
      alert("承認に失敗しました");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectionReason.trim()) return;
    setProcessing(id);
    try {
      await apiFetch(`/api/v1/admin/creators/${id}/review`, {
        method: "POST",
        body: JSON.stringify({
          approve: false,
          rejectionReason: rejectionReason.trim(),
        }),
      });
      setRejectingId(null);
      setRejectionReason("");
      router.refresh();
    } catch {
      alert("却下に失敗しました");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-xs font-medium transition ${
              statusFilter === tab.value
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200">
        {/* Header */}
        <div className="grid grid-cols-[0.6fr_1fr_0.8fr_0.8fr_0.7fr_0.5fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>申請ID</span>
          <span>申請者名</span>
          <span>クリエイターID</span>
          <span>専門分野</span>
          <span>日付</span>
          <span>ステータス</span>
          <span>アクション</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            該当する申請が見つかりません
          </div>
        ) : (
          filtered.map((app) => {
            const status = STATUS_LABELS[app.status];
            return (
              <div key={app.id}>
                <div className="grid grid-cols-[0.6fr_1fr_0.8fr_0.8fr_0.7fr_0.5fr_0.8fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm">
                  <span className="font-mono text-xs text-gray-400 truncate">
                    {app.id.slice(0, 8)}
                  </span>
                  <div className="truncate">
                    <span className="text-black">{app.userName}</span>
                    <span className="text-xs text-gray-400 block truncate">
                      {app.userEmail}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-600 truncate">
                    {app.creatorIdSlug}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(app.specialties ?? []).slice(0, 2).map((s) => (
                      <span
                        key={s}
                        className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(app.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  <span>
                    <span
                      className={`text-xs px-2 py-0.5 font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </span>
                  <span>
                    {app.status === "PENDING" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprove(app.id)}
                          disabled={processing === app.id}
                          className="px-2 py-1 text-xs bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => setRejectingId(app.id)}
                          disabled={processing === app.id}
                          className="px-2 py-1 text-xs border border-gray-200 text-gray-600 hover:border-black hover:text-black transition disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    )}
                  </span>
                </div>

                {/* Inline Rejection Form */}
                {rejectingId === app.id && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
                          却下理由
                        </label>
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
                          placeholder="却下理由を入力..."
                        />
                      </div>
                      <button
                        onClick={() => handleReject(app.id)}
                        disabled={
                          processing === app.id || !rejectionReason.trim()
                        }
                        className="px-3 py-2 text-xs bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
                      >
                        確定
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason("");
                        }}
                        className="px-3 py-2 text-xs border border-gray-200 text-gray-600 hover:border-black transition"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
