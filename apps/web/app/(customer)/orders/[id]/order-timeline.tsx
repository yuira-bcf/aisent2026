"use client";

const STEPS = [
  { key: "ordered", label: "注文", icon: "receipt_long" },
  { key: "confirmed", label: "確認", icon: "check_circle" },
  { key: "manufacturing", label: "製造", icon: "science" },
  { key: "shipped", label: "発送", icon: "local_shipping" },
  { key: "delivered", label: "配達", icon: "inventory_2" },
] as const;

function getCompletedIndex(status: string): number {
  switch (status) {
    case "PENDING":
      return 0;
    case "CONFIRMED":
    case "PAID":
      return 1;
    case "PREPARING":
    case "MANUFACTURING":
    case "MANUFACTURED":
      return 2;
    case "SHIPPED":
      return 3;
    case "DELIVERED":
      return 4;
    default:
      return -1;
  }
}

export default function OrderTimeline({
  currentStatus,
}: {
  currentStatus: string;
}) {
  if (currentStatus === "CANCELLED") {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-50 text-red-700">
          <span className="material-symbols-outlined text-base">cancel</span>
          キャンセル済み
        </span>
      </div>
    );
  }

  const completedIndex = getCompletedIndex(currentStatus);

  return (
    <div className="flex items-center justify-between w-full py-4">
      {STEPS.map((step, i) => {
        const isCompleted = i <= completedIndex;
        const isCurrent = i === completedIndex;
        const isLast = i === STEPS.length - 1;

        return (
          <div
            key={step.key}
            className="flex items-center flex-1 last:flex-none"
          >
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center rounded-full transition-all ${
                  isCurrent
                    ? "w-10 h-10 bg-black text-white"
                    : isCompleted
                      ? "w-8 h-8 bg-black text-white"
                      : "w-8 h-8 bg-gray-200 text-gray-400"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: isCurrent ? 20 : 16 }}
                >
                  {step.icon}
                </span>
              </div>
              <span
                className={`text-xs mt-1.5 ${
                  isCompleted ? "text-black font-medium" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-20px] ${
                  i < completedIndex ? "bg-black" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
