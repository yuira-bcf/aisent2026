import { auth } from "@/lib/auth";
import { getMyApplication } from "@/lib/services/creator-profile-service";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicationForm } from "./application-form";

const STATUS_LABELS: Record<
  string,
  { label: string; icon: string; description: string }
> = {
  PENDING: {
    label: "審査中",
    icon: "hourglass_top",
    description: "申請は現在審査中です。結果が出るまでしばらくお待ちください。",
  },
  APPROVED: {
    label: "承認済み",
    icon: "check_circle",
    description:
      "申請が承認されました。クリエイターダッシュボードをご利用いただけます。",
  },
  REJECTED: {
    label: "却下",
    icon: "cancel",
    description: "申請が却下されました。",
  },
};

export default async function CreatorApplicationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // If user is already a CREATOR, show a message
  if (session.user.role === "CREATOR") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="border border-gray-200 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-black mb-3 block">
            palette
          </span>
          <h1 className="text-lg font-bold text-black mb-2">
            クリエイターとして登録済みです
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            クリエイターダッシュボードから活動を始めましょう。
          </p>
          <Link
            href="/creator/dashboard"
            className="inline-block px-6 py-2.5 text-sm bg-black text-white hover:bg-gray-800 transition"
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>
    );
  }

  const application = await getMyApplication(session.user.id);

  // If there's a pending application, show status
  if (application && application.status === "PENDING") {
    const status = STATUS_LABELS[application.status];
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            クリエイター申請
          </h1>
        </div>
        <div className="border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-2xl text-black">
              {status.icon}
            </span>
            <h2 className="text-lg font-bold text-black">{status.label}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">{status.description}</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-400">表示名</span>
              <span className="text-black">{application.displayName}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-400">クリエイターID</span>
              <span className="text-black font-mono">
                {application.creatorIdSlug}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-400">申請日</span>
              <span className="text-black">
                {new Date(application.createdAt).toLocaleDateString("ja-JP")}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If rejected, allow re-application by showing the form again
  // If no application, show the form
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          クリエイター申請
        </h1>
        <p className="text-sm text-gray-400">
          クリエイターとして活動するための申請フォームです。
        </p>
      </div>

      {application && application.status === "REJECTED" && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mb-6">
          <span className="material-symbols-outlined text-base text-red-500">
            info
          </span>
          前回の申請は却下されました。
          {application.rejectionReason && (
            <span>理由: {application.rejectionReason}</span>
          )}
        </div>
      )}

      <ApplicationForm />
    </div>
  );
}
