import { db } from "@/lib/db";
import { ecSettings } from "@kyarainnovate/db/schema";
import { EcSettingsForm } from "./ec-settings-form";

const DEFAULTS = {
  shippingFeeYen: 0,
  taxRate: "10.0",
  freeShippingThresholdYen: 5000,
  paymentProvider: "stripe",
};

export default async function AdminEcSettingsPage() {
  const rows = await db.select().from(ecSettings).limit(1);
  const settings = rows[0] ?? DEFAULTS;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          EC設定
        </h1>
        <p className="text-sm text-gray-400">送料・税率・決済の設定</p>
      </div>
      <EcSettingsForm
        initial={{
          shippingFeeYen: settings.shippingFeeYen,
          taxRate: String(settings.taxRate),
          freeShippingThresholdYen: settings.freeShippingThresholdYen,
          paymentProvider: settings.paymentProvider,
        }}
      />
    </div>
  );
}
