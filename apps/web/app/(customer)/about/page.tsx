import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AboutPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">
        KyaraInnovate について
      </h1>

      <div className="space-y-6">
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            バージョン
          </p>
          <p className="text-sm font-medium">v1.0.0</p>
        </div>

        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            KyaraInnovateは、AIとクリエイターの力で、あなただけのオリジナル香水を作り出すプラットフォームです。
            香りのイメージをテキストで伝えるだけで、AIが最適なノート構成を提案し、プロのクリエイターが調合・製品化します。
          </p>
          <p>
            従来のオーダーメイド香水は高価で時間がかかるものでしたが、KyaraInnovateではAI技術を活用することで、
            手軽に、そして手頃な価格でパーソナライズされた香りを楽しむことができます。
          </p>
          <p>
            お気に入りのクリエイターをフォローしたり、他のユーザーのレシピからインスピレーションを得たり、
            香りを通じた新しいコミュニティ体験をお楽しみください。
          </p>
        </div>

        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
            技術情報
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>Next.js (App Router)</li>
            <li>React</li>
            <li>TypeScript</li>
            <li>Tailwind CSS</li>
            <li>Prisma ORM</li>
          </ul>
        </div>

        <p className="text-xs text-gray-400 text-center pt-4">
          &copy; 2026 KyaraInnovate. All rights reserved.
        </p>
      </div>
    </div>
  );
}
