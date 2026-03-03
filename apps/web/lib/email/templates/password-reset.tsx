import * as React from "react";

export function PasswordResetEmail({
  resetUrl,
  userName,
}: { resetUrl: string; userName: string }) {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ color: "#000" }}>パスワードリセット</h2>
      <p>{userName} さん</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
      <a
        href={resetUrl}
        style={{
          display: "inline-block",
          padding: "12px 24px",
          backgroundColor: "#000",
          color: "#fff",
          textDecoration: "none",
          fontSize: "14px",
        }}
      >
        パスワードをリセット
      </a>
      <p style={{ color: "#666", fontSize: "12px", marginTop: "24px" }}>
        このリンクは1時間後に無効になります。
      </p>
      <p style={{ color: "#666", fontSize: "12px" }}>
        このメールに心当たりがない場合は無視してください。
      </p>
    </div>
  );
}
