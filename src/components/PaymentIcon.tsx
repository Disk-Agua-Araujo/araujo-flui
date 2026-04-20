import { Banknote, CreditCard, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethodKey = "cash" | "pix" | "card";

interface PaymentIconProps {
  method: PaymentMethodKey | string;
  size?: number;
  className?: string;
}

/**
 * Reusable payment-method icon. Color is inherited via `currentColor`,
 * so it adapts automatically to dark/light contexts.
 */
export function PaymentIcon({ method, size = 20, className }: PaymentIconProps) {
  const Icon =
    method === "cash" ? Banknote :
    method === "pix"  ? QrCode   :
    method === "card" ? CreditCard :
    null;

  if (!Icon) return null;
  return <Icon size={size} className={cn("inline-block shrink-0", className)} aria-hidden />;
}

export const PAYMENT_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
};
