declare module "resend" {
  interface SendEmailParams {
    from: string;
    to: string;
    subject: string;
    react?: React.ReactElement;
    html?: string;
  }
  interface SendEmailResponse {
    id: string;
  }
  class Resend {
    constructor(apiKey?: string);
    emails: {
      send(
        params: SendEmailParams,
      ): Promise<{ data: SendEmailResponse | null; error: unknown }>;
    };
  }
  export { Resend };
}
