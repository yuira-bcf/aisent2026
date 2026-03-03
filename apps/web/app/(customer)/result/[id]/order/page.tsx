import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  blendRequests,
  blendResults,
  products,
  shippingAddresses,
} from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OrderForm from "./order-form";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Fetch blend request + result
  const request = await db.query.blendRequests.findFirst({
    where: and(
      eq(blendRequests.id, id),
      eq(blendRequests.userId, session.user.id),
    ),
    with: {
      result: {
        with: {
          flavors: { with: { flavor: true } },
        },
      },
    },
  });

  if (!request || !request.result) notFound();

  // Find product linked to this blend result
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.blendResultId, request.result.id),
      eq(products.isActive, true),
    ),
  });

  // Fetch user's shipping addresses
  const addresses = await db.query.shippingAddresses.findMany({
    where: eq(shippingAddresses.userId, session.user.id),
    orderBy: shippingAddresses.createdAt,
  });

  const blendName = request.name ?? "無題のフレグランス";
  const topRatio = Number(request.topRatio);
  const middleRatio = Number(request.middleRatio);
  const lastRatio = Number(request.lastRatio);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            注文確認
          </h1>
          <p className="text-sm text-gray-400">{blendName}</p>
        </div>
        <Link
          href={`/result/${id}`}
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          結果に戻る
        </Link>
      </div>

      {!product ? (
        <div className="border border-gray-200 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            inventory_2
          </span>
          <p className="text-sm text-gray-500">
            この香りはまだ商品化されていません
          </p>
          <Link
            href={`/result/${id}`}
            className="inline-block mt-4 text-sm text-black underline"
          >
            結果ページに戻る
          </Link>
        </div>
      ) : (
        <OrderForm
          blendRequestId={id}
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            priceYen: product.priceYen,
            imageUrl: product.imageUrl,
          }}
          blendName={blendName}
          noteRatios={{ top: topRatio, middle: middleRatio, last: lastRatio }}
          addresses={addresses.map((a) => ({
            id: a.id,
            label: a.label,
            recipientName: a.recipientName,
            postalCode: a.postalCode,
            prefecture: a.prefecture,
            city: a.city,
            addressLine1: a.addressLine1,
            isDefault: a.isDefault,
          }))}
        />
      )}
    </div>
  );
}
