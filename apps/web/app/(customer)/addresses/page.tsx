import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shippingAddresses } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import AddressManager from "./address-manager";

export default async function AddressesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const addresses = await db
    .select()
    .from(shippingAddresses)
    .where(eq(shippingAddresses.userId, session.user.id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          配送先管理
        </h1>
        <p className="text-sm text-gray-400">{addresses.length}件の配送先</p>
      </div>

      <AddressManager initialAddresses={addresses} />
    </div>
  );
}
