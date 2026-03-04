"use server";

import { auth } from "@/lib/auth";
import { updateFlavorPreferences } from "@/lib/services/personalization-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function recalculatePreferences() {
  const session = await auth();
  if (!session) redirect("/login");

  await updateFlavorPreferences(session.user.id);

  revalidatePath("/profile/preferences");
}
