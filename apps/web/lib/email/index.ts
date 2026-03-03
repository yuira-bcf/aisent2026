import { env } from "@/lib/env";
import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<void> {
  await getResend().emails.send({
    from: "KyaraInnovate <noreply@kyarainnovate.com>",
    to: params.to,
    subject: params.subject,
    react: params.react,
  });
}
