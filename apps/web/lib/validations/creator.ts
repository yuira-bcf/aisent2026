import { z } from "zod";

// ---------------------------------------------------------------------------
// Creator Application (クリエーター登録申請)
// ---------------------------------------------------------------------------

export const creatorApplicationSchema = z.object({
  displayName: z.string().min(2).max(50),
  creatorIdSlug: z
    .string()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "クリエーターIDは半角英数字とアンダースコアのみ（3〜20文字）",
    ),
  bio: z.string().min(10).max(1000),
  specialties: z
    .array(
      z.enum(["FLORAL", "WOODY", "CITRUS", "ORIENTAL", "FRESH", "GOURMAND"]),
    )
    .min(1)
    .max(5),
  portfolioDescription: z.string().max(2000).optional(),
  motivation: z.string().min(50).max(500),
});

export type CreatorApplicationInput = z.infer<typeof creatorApplicationSchema>;

// ---------------------------------------------------------------------------
// Profile Update (プロフィール更新)
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  specialties: z.array(z.string()).max(10).optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional(),
      instagram: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Style Update (スタイルプロファイル更新)
// ---------------------------------------------------------------------------

export const updateStyleSchema = z.object({
  styleDescription: z.string().max(2000).optional(),
  stylePrompt: z.string().max(500).optional(),
  styleNoteBalance: z
    .object({
      topBias: z.number().min(-0.3).max(0.3),
      middleBias: z.number().min(-0.3).max(0.3),
      lastBias: z.number().min(-0.3).max(0.3),
    })
    .optional(),
  styleFlavorPreferences: z
    .array(
      z.object({
        flavorId: z.string().uuid(),
        bias: z.number().min(-0.5).max(0.5),
      }),
    )
    .max(10)
    .optional(),
});

export type UpdateStyleInput = z.infer<typeof updateStyleSchema>;
