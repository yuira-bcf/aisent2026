import * as React from "react";

export function CreatorRejectedEmail({
  userName,
  reason,
}: {
  userName: string;
  reason?: string;
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
        クリエイター申請の結果
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {userName} 様
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        クリエイター申請を審査いたしましたが、今回は承認に至りませんでした。
      </p>
      {reason && (
        <div
          style={{
            background: "#f9f9f9",
            padding: 16,
            marginBottom: 16,
            borderLeft: "3px solid #ccc",
          }}
        >
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
            <strong>理由:</strong> {reason}
          </p>
        </div>
      )}
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        申請内容をご確認の上、再度お申し込みいただくことも可能です。
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
