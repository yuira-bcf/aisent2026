import { z } from "zod";

/**
 * Server-side environment variable schema.
 *
 * Required variables will cause a startup error if missing.
 * Optional variables default to undefined and can be checked at runtime.
 */
const serverEnvSchema = z.object({
  // ─── Database ───────────────────────────────────────────
  DATABASE_URL: z
    .string({
      required_error:
        "DATABASE_URL is required. Example: postgresql://user:pass@host:5432/dbname",
    })
    .url("DATABASE_URL must be a valid URL"),

  // ─── Auth.js ────────────────────────────────────────────
  AUTH_SECRET: z
    .string({
      required_error:
        "AUTH_SECRET is required. Generate with: openssl rand -base64 32",
    })
    .min(16, "AUTH_SECRET must be at least 16 characters"),

  AUTH_URL: z
    .string({
      required_error:
        "AUTH_URL is required. Example: https://kyarainnovate.com",
    })
    .url("AUTH_URL must be a valid URL"),

  // ─── Stripe ─────────────────────────────────────────────
  STRIPE_SECRET_KEY: z
    .string({
      required_error:
        "STRIPE_SECRET_KEY is required. Get it from https://dashboard.stripe.com/apikeys",
    })
    .refine(
      (val) => val.startsWith("sk_test_") || val.startsWith("sk_live_"),
      "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_",
    ),

  STRIPE_WEBHOOK_SECRET: z
    .string({
      required_error:
        "STRIPE_WEBHOOK_SECRET is required. Get it from Stripe webhook settings",
    })
    .refine(
      (val) => val.startsWith("whsec_"),
      "STRIPE_WEBHOOK_SECRET must start with whsec_",
    ),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string({
      required_error:
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required. Get it from https://dashboard.stripe.com/apikeys",
    })
    .refine(
      (val) => val.startsWith("pk_test_") || val.startsWith("pk_live_"),
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_",
    ),

  // ─── Optional: Sentry ──────────────────────────────────
  SENTRY_DSN: z.string().url("SENTRY_DSN must be a valid URL").optional(),

  // ─── Optional: Redis ───────────────────────────────────
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL").optional(),

  // ─── Optional: Resend ──────────────────────────────────
  RESEND_API_KEY: z.string().optional(),

  // ─── Optional: OpenAI / AI Service ─────────────────────
  OPENAI_API_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().url().optional().default("http://localhost:8081"),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function validateEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  ${field}: ${messages?.join(", ")}`)
      .join("\n");

    throw new Error(
      `\n${"=".repeat(60)}\n  Missing or invalid environment variables:\n\n${errorMessages}\n\n  Copy .env.example to .env and fill in the required values.\n${"=".repeat(60)}\n`,
    );
  }

  return parsed.data;
}

/**
 * Validated environment variables.
 *
 * Import this instead of accessing process.env directly to get
 * type-safe, validated environment variables with clear error messages.
 *
 * @example
 * ```ts
 * import { env } from '@/lib/env';
 *
 * const stripe = new Stripe(env.STRIPE_SECRET_KEY);
 * ```
 */
export const env = validateEnv();
