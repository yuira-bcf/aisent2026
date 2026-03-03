export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "MANUFACTURING"
  | "MANUFACTURED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["MANUFACTURING", "CANCELLED"],
  MANUFACTURING: ["MANUFACTURED"],
  MANUFACTURED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
} as const;

export function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): void {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(", ") || "none (terminal state)"}`,
    );
  }
}

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
];
export const TERMINAL_STATUSES: OrderStatus[] = ["CANCELLED", "RETURNED"];
