import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const faqs = [
  {
    q: "香りの調合はどのように行いますか？",
    a: "「調合」ページから、お好みの香りのイメージや雰囲気をAIに伝えることで、あなただけのオリジナルレシピを作成できます。テキストで自由に香りの希望を入力し、AIがノート構成を提案します。",
  },
  {
    q: "注文方法を教えてください",
    a: "ショップから商品をカートに追加し、配送先を選択して注文を確定してください。お支払い完了後、クリエイターが調合・発送いたします。",
  },
  {
    q: "注文をキャンセルできますか？",
    a: "注文詳細ページから、ステータスが「保留中」の注文はキャンセル可能です。調合が開始された後のキャンセルはできませんのでご了承ください。",
  },
  {
    q: "クリエイターになるにはどうすればよいですか？",
    a: "「クリエイター申請」ページから必要事項を入力して申請してください。運営チームが審査を行い、承認されるとクリエイターとして活動を開始できます。",
  },
  {
    q: "配送先はいくつまで登録できますか？",
    a: "複数の配送先を登録できます。配送先管理ページから追加・編集・削除が可能です。デフォルトの配送先を設定しておくと、注文時に便利です。",
  },
  {
    q: "パスワードを忘れました",
    a: "ログインページの「パスワードをお忘れですか？」リンクからパスワードリセットを行ってください。登録済みのメールアドレスにリセットリンクが送信されます。",
  },
];

export default async function HelpPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">ヘルプ</h1>

      <div className="space-y-2 mb-10">
        {faqs.map((faq, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static FAQ list
          <details key={i} className="border border-gray-200 bg-white group">
            <summary className="flex items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer select-none">
              <span>{faq.q}</span>
              <span className="material-symbols-outlined text-gray-400 text-lg transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-bold tracking-tight mb-2">お問い合わせ</h2>
        <p className="text-sm text-gray-600">
          上記で解決しない場合は、以下のメールアドレスまでお問い合わせください。
        </p>
        <p className="text-sm font-medium mt-2">support@kyarainnovate.com</p>
      </div>
    </div>
  );
}
