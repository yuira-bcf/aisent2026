import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";

export default async function TasteOnboardingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <OnboardingForm />
    </div>
  );
}
