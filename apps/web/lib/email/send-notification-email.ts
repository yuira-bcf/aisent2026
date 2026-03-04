import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { users } from "@kyarainnovate/db/schema";
import type { NotificationType } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import { CreatorApprovedEmail } from "./templates/creator-approved";
import { CreatorRejectedEmail } from "./templates/creator-rejected";
import { OrderCancelledEmail } from "./templates/order-cancelled";
import { OrderConfirmedEmail } from "./templates/order-confirmed";
import { OrderDeliveredEmail } from "./templates/order-delivered";
import { OrderShippedEmail } from "./templates/order-shipped";
import { RecipeOrderedEmail } from "./templates/recipe-ordered";
import { ReviewReceivedEmail } from "./templates/review-received";
import { RoyaltyPaidEmail } from "./templates/royalty-paid";
import { SystemAnnouncementEmail } from "./templates/system-announcement";
import { TierChangedEmail } from "./templates/tier-changed";

export async function sendNotificationEmail(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, name: true },
  });
  if (!user) return;

  let subject: string;
  let react: React.ReactElement;

  switch (type) {
    case "ORDER_CONFIRMED":
      subject = "注文が確定しました - KyaraInnovate";
      react = OrderConfirmedEmail({
        orderId: data.orderId as string,
        userName: user.name,
        totalYen: (data.totalYen as number) ?? 0,
      });
      break;
    case "ORDER_SHIPPED":
      subject = "注文が発送されました - KyaraInnovate";
      react = OrderShippedEmail({
        orderId: data.orderId as string,
        userName: user.name,
      });
      break;
    case "ORDER_CANCELLED":
      subject = "注文がキャンセルされました - KyaraInnovate";
      react = OrderCancelledEmail({
        orderId: data.orderId as string,
        userName: user.name,
      });
      break;
    case "REVIEW_RECEIVED":
      subject = "新しいレビューが投稿されました - KyaraInnovate";
      react = ReviewReceivedEmail({
        recipeName: data.recipeName as string,
        rating: data.rating as number,
        creatorName: user.name,
      });
      break;
    case "CREATOR_APPROVED":
      subject = "クリエイター申請が承認されました - KyaraInnovate";
      react = CreatorApprovedEmail({ userName: user.name });
      break;
    case "CREATOR_REJECTED":
      subject = "クリエイター申請の結果 - KyaraInnovate";
      react = CreatorRejectedEmail({
        userName: user.name,
        reason: data.rejectionReason as string | undefined,
      });
      break;
    case "ROYALTY_PAID":
      subject = "ロイヤリティが支払われました - KyaraInnovate";
      react = RoyaltyPaidEmail({
        userName: user.name,
        amount: data.amount as number | undefined,
        period: data.period as string | undefined,
      });
      break;
    case "ORDER_DELIVERED":
      subject = "ご注文が配達されました - KyaraInnovate";
      react = OrderDeliveredEmail({
        orderId: data.orderId as string,
        userName: user.name,
      });
      break;
    case "RECIPE_ORDERED":
      subject = "あなたのレシピが注文されました - KyaraInnovate";
      react = RecipeOrderedEmail({
        creatorName: user.name,
        recipeName: data.recipeName as string,
        orderId: data.orderId as string | undefined,
      });
      break;
    case "TIER_CHANGED":
      subject = "ティアが変更されました - KyaraInnovate";
      react = TierChangedEmail({
        userName: user.name,
        newTier: data.newTier as string | undefined,
      });
      break;
    case "SYSTEM_ANNOUNCEMENT":
      subject = "お知らせ - KyaraInnovate";
      react = SystemAnnouncementEmail({
        userName: user.name,
        message: data.message as string | undefined,
      });
      break;
    default:
      return;
  }

  try {
    await sendEmail({ to: user.email, subject, react });
  } catch (error) {
    console.error("[send-notification-email] メール送信に失敗:", error);
  }
}
