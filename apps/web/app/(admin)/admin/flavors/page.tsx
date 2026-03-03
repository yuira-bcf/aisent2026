import { getAllFlavors } from "@/lib/services/flavor-service";
import { FlavorsManager } from "./flavors-manager";

export default async function AdminFlavorsPage() {
  const flavors = await getAllFlavors();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          香料マスタ管理
        </h1>
        <p className="text-sm text-gray-400">香料の追加・編集・削除</p>
      </div>
      <FlavorsManager initialFlavors={flavors} />
    </div>
  );
}
