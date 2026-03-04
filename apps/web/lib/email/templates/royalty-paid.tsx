import * as React from "react";

export function RoyaltyPaidEmail({
  userName,
  amount,
  period,
}: {
  userName: string;
  amount?: number;
  period?: string;
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
        ロイヤリティが支払われました
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {userName} 様
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        ロイヤリティの支払いが完了しました。
      </p>
      {(amount != null || period) && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 24,
          }}
        >
          <tbody>
            {period && (
              <tr>
                <td
                  style={{
                    fontSize: 13,
                    color: "#666",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  対象期間
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
                  {period}
                </td>
              </tr>
            )}
            {amount != null && (
              <tr>
                <td
                  style={{
                    fontSize: 13,
                    color: "#666",
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  支払金額
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
                  {amount.toLocaleString()}円
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666" }}>
        詳細はダッシュボードをご確認ください。
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
