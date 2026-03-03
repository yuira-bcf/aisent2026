import * as React from "react";

export function OrderConfirmedEmail({
  orderId,
  userName,
  totalYen,
}: {
  orderId: string;
  userName: string;
  totalYen: number;
}) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 600,
        margin: "0 auto",
        padding: 32,
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        注文が確定しました
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {userName} 様
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        ご注文ありがとうございます。以下の注文が確定しました。
      </p>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}
      >
        <tbody>
          <tr>
            <td
              style={{
                fontSize: 13,
                color: "#666",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              注文番号
            </td>
            <td
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                textAlign: "right",
              }}
            >
              {orderId}
            </td>
          </tr>
          <tr>
            <td
              style={{
                fontSize: 13,
                color: "#666",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              合計金額
            </td>
            <td
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                textAlign: "right",
              }}
            >
              {totalYen.toLocaleString()}円（税込）
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666" }}>
        準備が整い次第、発送いたします。発送時に再度メールでお知らせいたします。
      </p>
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #eee",
          margin: "32px 0 16px",
        }}
      />
      <p style={{ fontSize: 11, color: "#999" }}>
        KyaraInnovate - このメールは自動送信されています。
      </p>
    </div>
  );
}
