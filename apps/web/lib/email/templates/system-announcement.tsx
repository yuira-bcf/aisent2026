import * as React from "react";

export function SystemAnnouncementEmail({
  userName,
  message,
}: {
  userName: string;
  message?: string;
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
        お知らせ
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {userName} 様
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        {message ?? "システムからのお知らせがあります。"}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666" }}>
        詳細はサイトをご確認ください。
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
