import { db } from "@/lib/db";
import { aiCalibrationParams } from "@kyarainnovate/db/schema";
import { CalibrationEditor } from "./calibration-editor";

export default async function AdminCalibrationPage() {
  const params = await db.select().from(aiCalibrationParams);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          キャリブレーション
        </h1>
        <p className="text-sm text-gray-400">AI調合パラメータの調整</p>
      </div>
      <CalibrationEditor initialParams={params} />
    </div>
  );
}
