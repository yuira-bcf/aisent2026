import {
  type ReceiptData,
  ReceiptDocument,
} from "@/components/receipt/receipt-pdf";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderItems, orders } from "@kyarainnovate/db/schema";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import React from "react";

// Company info (will be moved to ec_settings in future)
const COMPANY = {
  name: "KyaraInnovate株式会社",
  address: "東京都千代田区千代田1-1-1",
  phone: "03-XXXX-XXXX",
  email: "support@kyarainnovate.com",
  invoiceRegistrationNumber: "T1234567890123",
};

const TAX_RATE = 0.1;

function formatDateJP(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * GET /api/v1/receipt/:orderId
 *
 * Generate and return a receipt PDF for the specified order.
 * Accessible by order owner or ADMIN.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orderId } = await ctx.params;

  // Fetch order with items
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!order) {
    return new Response("Not Found", { status: 404 });
  }

  // Authorization: owner or ADMIN
  if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  // Only paid orders can have receipts (not PENDING or CANCELLED without payment)
  const RECEIPT_ALLOWED = [
    "CONFIRMED",
    "PREPARING",
    "MANUFACTURING",
    "MANUFACTURED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ];
  if (!RECEIPT_ALLOWED.includes(order.status)) {
    return new Response("決済が完了していない注文の領収書は発行できません", {
      status: 400,
    });
  }

  // Calculate tax (内税方式)
  const taxAmount = Math.floor((order.totalYen * TAX_RATE) / (1 + TAX_RATE));
  const taxExcluded = order.totalYen - taxAmount;

  // Calculate subtotal from items
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.priceYen * item.quantity,
    0,
  );

  // Determine if reissue
  const isReissue = order.receiptCount > 0;

  // Build receipt data
  const receiptData: ReceiptData = {
    receiptNumber: `KI-${order.id.slice(0, 8).toUpperCase()}`,
    issuedDate: formatDateJP(new Date()),
    isReissue,
    customerName: order.shippingRecipientName,
    customerPostalCode: order.shippingPostalCode,
    customerAddress: `${order.shippingPrefecture}${order.shippingCity}${order.shippingAddressLine1}${order.shippingAddressLine2 ?? ""}`,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.priceYen,
      amount: item.priceYen * item.quantity,
    })),
    subtotal,
    discountYen: order.discountYen,
    total: order.totalYen,
    taxExcluded,
    taxAmount,
    paymentMethod: "クレジットカード",
    paidAt: formatDateJP(order.createdAt),
    orderId: order.id,
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    companyPhone: COMPANY.phone,
    companyEmail: COMPANY.email,
    invoiceRegistrationNumber: COMPANY.invoiceRegistrationNumber,
  };

  // Update receipt count
  await db
    .update(orders)
    .set({
      receiptIssuedAt: order.receiptIssuedAt ?? new Date(),
      receiptCount: order.receiptCount + 1,
    })
    .where(eq(orders.id, orderId));

  // Generate PDF
  const buffer = await renderToBuffer(
    // biome-ignore lint/suspicious/noExplicitAny: react-pdf renderToBuffer requires any
    React.createElement(ReceiptDocument, { data: receiptData }) as any,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receiptData.receiptNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
