import { Document, Font, Page, Text, View } from "@react-pdf/renderer";
import React from "react";
import { styles } from "./receipt-styles";

// Register Noto Sans JP from Google Fonts CDN
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/notosansjp/v53/Ia2dPDRBp63JB72hkWCB.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/notosansjp/v53/Ia2dPDRBp63JB72hkWCB.ttf",
      fontWeight: "bold",
    },
  ],
});

// Fallback: register a basic font if CDN fails
Font.registerHyphenationCallback((word) => [word]);

export type ReceiptItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type ReceiptData = {
  receiptNumber: string;
  issuedDate: string;
  isReissue: boolean;
  customerName: string;
  customerPostalCode: string;
  customerAddress: string;
  items: ReceiptItem[];
  subtotal: number;
  discountYen: number;
  total: number;
  taxExcluded: number;
  taxAmount: number;
  paymentMethod: string;
  paidAt: string;
  orderId: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  invoiceRegistrationNumber: string;
};

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>領 収 書</Text>
            <Text style={styles.headerSub}>RECEIPT / INVOICE</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerNumber}>No. {data.receiptNumber}</Text>
            <Text style={styles.headerDate}>発行日: {data.issuedDate}</Text>
            {data.isReissue && (
              <Text style={styles.reissueLabel}>（再発行）</Text>
            )}
          </View>
        </View>

        {/* Customer */}
        <View style={styles.addressSection}>
          <Text style={styles.customerName}>{data.customerName} 様</Text>
          <Text style={styles.customerAddress}>
            〒{data.customerPostalCode} {data.customerAddress}
          </Text>
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>合計金額（税込）</Text>
          <Text style={styles.totalAmount}>{formatYen(data.total)}</Text>
          <Text style={styles.totalTax}>
            うち消費税額 {formatYen(data.taxAmount)}
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>ご注文明細</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>商品名</Text>
            <Text style={styles.colQty}>数量</Text>
            <Text style={styles.colPrice}>単価</Text>
            <Text style={styles.colTotal}>金額</Text>
          </View>
          {data.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: order items may lack unique IDs
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colName}>{item.productName}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatYen(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatYen(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>小計</Text>
            <Text>{formatYen(data.subtotal)}</Text>
          </View>
          {data.discountYen > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>割引</Text>
              <Text>-{formatYen(data.discountYen)}</Text>
            </View>
          )}
          <View style={styles.summaryTotalRow}>
            <Text>合計（税込）</Text>
            <Text>{formatYen(data.total)}</Text>
          </View>
        </View>

        {/* Tax Breakdown */}
        <View style={styles.taxSection}>
          <Text style={styles.sectionTitle}>消費税内訳</Text>
          <View style={styles.taxRow}>
            <Text style={styles.summaryLabel}>10%対象</Text>
            <Text>税抜 {formatYen(data.taxExcluded)}</Text>
            <Text>消費税 {formatYen(data.taxAmount)}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>お支払い情報</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>お支払い方法</Text>
            <Text>{data.paymentMethod}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>お支払い日</Text>
            <Text>{data.paidAt}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>注文番号</Text>
            <Text>{data.orderId.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Issuer */}
        <View style={styles.issuerSection}>
          <Text style={styles.sectionTitle}>発行者</Text>
          <Text style={styles.issuerName}>{data.companyName}</Text>
          <Text style={styles.issuerDetail}>{data.companyAddress}</Text>
          <Text style={styles.issuerDetail}>TEL: {data.companyPhone}</Text>
          <Text style={styles.issuerDetail}>{data.companyEmail}</Text>
          <View style={styles.registrationBox}>
            <Text style={styles.registrationLabel}>
              適格請求書発行事業者登録番号
            </Text>
            <Text style={styles.registrationNumber}>
              {data.invoiceRegistrationNumber}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            この領収書は電子的に発行されたものです。
          </Text>
          <Text style={styles.footerText}>
            上記の金額を正に領収いたしました。
          </Text>
        </View>
      </Page>
    </Document>
  );
}
