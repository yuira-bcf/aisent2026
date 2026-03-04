import * as React from "react";

export function RecipeOrderedEmail({
  creatorName,
  recipeName,
  orderId,
}: {
  creatorName: string;
  recipeName: string;
  orderId?: string;
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
        あなたのレシピが注文されました
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {creatorName} 様
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        あなたのレシピ商品に新しい注文が入りました。
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
              レシピ名
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
              {recipeName}
            </td>
          </tr>
          {orderId && (
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
          )}
        </tbody>
      </table>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666" }}>
        詳細はダッシュボードからご確認いただけます。
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
