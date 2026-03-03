import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsForm from "./settings-form";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            通知設定
          </h1>
          <p className="text-sm text-gray-400">
            メール通知の受信設定を管理します
          </p>
        </div>
        <Link
          href="/notifications"
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          通知一覧へ
        </Link>
      </div>

      <SettingsForm />
    </div>
  );
}
