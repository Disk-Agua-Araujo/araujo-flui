import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PaymentIcon, PAYMENT_LABELS, type PaymentMethodKey } from "@/components/PaymentIcon";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const METHODS: PaymentMethodKey[] = ["cash", "pix", "card"];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface SplitPaymentValue {
  isSplit: boolean;
  paymentMethod: string;       // method 1
  paymentMethod2: string;      // method 2
  totalAmount: string;
  paymentAmount1: string;
  paymentAmount2: string;
  changeFor: string;           // change for method 1 (if cash)
  changeFor2: string;          // change for method 2 (if cash)
}

export const emptySplitPayment = (): SplitPaymentValue => ({
  isSplit: false,
  paymentMethod: "",
  paymentMethod2: "",
  totalAmount: "",
  paymentAmount1: "",
  paymentAmount2: "",
  changeFor: "",
  changeFor2: "",
});

interface Props {
  value: SplitPaymentValue;
  onChange: (next: SplitPaymentValue) => void;
  /** Compact layout (used inside edit modal). */
  compact?: boolean;
}

export function SplitPaymentSection({ value, onChange, compact = false }: Props) {
  const v = value;
  const total = parseFloat(v.totalAmount) || 0;
  const amt1 = parseFloat(v.paymentAmount1) || 0;
  const amt2 = parseFloat(v.paymentAmount2) || 0;
  const sum = amt1 + amt2;
  const change1 = parseFloat(v.changeFor) || 0;
  const change2 = parseFloat(v.changeFor2) || 0;

  const set = (patch: Partial<SplitPaymentValue>) => onChange({ ...v, ...patch });

  // ---- Simple payment (current behavior) ----
  const renderSimple = () => (
    <>
      <div className="flex gap-2 flex-wrap">
        {METHODS.map((m) => (
          <Button
            key={m}
            type="button"
            variant={v.paymentMethod === m ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const newMethod = v.paymentMethod === m ? "" : m;
              set({
                paymentMethod: newMethod,
                changeFor: newMethod === "cash" ? v.changeFor : "",
              });
            }}
          >
            <PaymentIcon method={m} size={16} />
            {PAYMENT_LABELS[m]}
          </Button>
        ))}
      </div>

      {v.paymentMethod && (
        <div className="space-y-3 pt-2">
          <div>
            <Label>Valor total do pedido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={v.totalAmount}
              onChange={(e) => set({ totalAmount: e.target.value })}
            />
          </div>
          {v.paymentMethod === "cash" && (
            <div>
              <Label>Troco para (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={v.changeFor}
                onChange={(e) => set({ changeFor: e.target.value })}
              />
              {change1 > 0 && total > 0 && change1 > total && (
                <p className="text-sm font-medium text-green-700 mt-1">
                  Troco: {formatCurrency(change1 - total)}
                </p>
              )}
              {change1 > 0 && total > 0 && change1 < total && (
                <p className="text-sm font-medium text-destructive mt-1">
                  Valor insuficiente para cobrir o pedido.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  // ---- Split payment ----
  const renderMethodButtons = (
    selected: string,
    onSelect: (m: string) => void,
    excludeMethod?: string,
  ) => (
    <div className="flex gap-1.5 flex-wrap">
      {METHODS.filter((m) => m !== excludeMethod).map((m) => (
        <Button
          key={m}
          type="button"
          size="sm"
          variant={selected === m ? "default" : "outline"}
          className="gap-1.5 h-8"
          onClick={() => onSelect(selected === m ? "" : m)}
        >
          <PaymentIcon method={m} size={14} />
          {PAYMENT_LABELS[m]}
        </Button>
      ))}
    </div>
  );

  // Auto-fill amount2 when amount1 is filled and total is set
  const handleAmount1Change = (val: string) => {
    const n = parseFloat(val) || 0;
    if (total > 0 && val !== "") {
      const remaining = Math.max(0, total - n);
      set({ paymentAmount1: val, paymentAmount2: remaining.toFixed(2) });
    } else {
      set({ paymentAmount1: val });
    }
  };

  const distributionOk = total > 0 && Math.abs(sum - total) < 0.005;
  const distributionMismatch = total > 0 && !distributionOk;

  const renderSplit = () => (
    <div className="space-y-3 pt-2">
      <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
        {/* Method 1 */}
        <div className="border rounded-md p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground">Método 1</p>
          {renderMethodButtons(v.paymentMethod, (m) => {
            const newMethod = m;
            // If method 2 equals new method, clear it
            const newMethod2 = v.paymentMethod2 === newMethod ? "" : v.paymentMethod2;
            set({
              paymentMethod: newMethod,
              paymentMethod2: newMethod2,
              changeFor: newMethod === "cash" ? v.changeFor : "",
            });
          })}
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={v.paymentAmount1}
              onChange={(e) => handleAmount1Change(e.target.value)}
            />
          </div>
          {v.paymentMethod === "cash" && (
            <div>
              <Label className="text-xs">Troco para (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={v.changeFor}
                onChange={(e) => set({ changeFor: e.target.value })}
              />
              {change1 > amt1 && amt1 > 0 && (
                <p className="text-xs font-medium text-green-700 mt-1">
                  Troco: {formatCurrency(change1 - amt1)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Method 2 */}
        <div className="border rounded-md p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground">Método 2</p>
          {renderMethodButtons(
            v.paymentMethod2,
            (m) => set({
              paymentMethod2: m,
              changeFor2: m === "cash" ? v.changeFor2 : "",
            }),
            v.paymentMethod || undefined,
          )}
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={v.paymentAmount2}
              onChange={(e) => set({ paymentAmount2: e.target.value })}
            />
          </div>
          {v.paymentMethod2 === "cash" && (
            <div>
              <Label className="text-xs">Troco para (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={v.changeFor2}
                onChange={(e) => set({ changeFor2: e.target.value })}
              />
              {change2 > amt2 && amt2 > 0 && (
                <p className="text-xs font-medium text-green-700 mt-1">
                  Troco: {formatCurrency(change2 - amt2)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>Valor total do pedido (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={v.totalAmount}
          onChange={(e) => set({ totalAmount: e.target.value })}
        />
      </div>

      {total > 0 && (
        <div
          className={`rounded-md p-2 text-sm flex items-center gap-2 ${
            distributionOk
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-orange-50 text-orange-800 border border-orange-200"
          }`}
        >
          {distributionOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>
            Distribuído: {formatCurrency(amt1)} + {formatCurrency(amt2)} = <strong>{formatCurrency(sum)}</strong>
            {distributionMismatch && (
              <> · falta {formatCurrency(Math.abs(total - sum))}</>
            )}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {!v.isSplit ? renderSimple() : renderSplit()}

      <div className="flex items-center justify-between rounded-md border p-2">
        <Label className="text-xs font-medium cursor-pointer" htmlFor="split-payment-toggle">
          Dividir pagamento entre dois métodos
        </Label>
        <Switch
          id="split-payment-toggle"
          checked={v.isSplit}
          onCheckedChange={(checked) => {
            if (checked) {
              // Activate split — keep current method as method 1
              set({
                isSplit: true,
                paymentAmount1: v.paymentAmount1 || "",
                paymentAmount2: v.paymentAmount2 || "",
              });
            } else {
              // Deactivate — keep method 1, clear method 2
              set({
                isSplit: false,
                paymentMethod2: "",
                paymentAmount1: "",
                paymentAmount2: "",
                changeFor2: "",
              });
            }
          }}
        />
      </div>
    </div>
  );
}

/** Validate split payment values. Returns error message or null. */
export function validateSplitPayment(v: SplitPaymentValue): string | null {
  if (!v.isSplit) return null;
  if (!v.paymentMethod || !v.paymentMethod2) {
    return "Selecione os dois métodos de pagamento.";
  }
  if (v.paymentMethod === v.paymentMethod2) {
    return "Os dois métodos de pagamento devem ser diferentes.";
  }
  const amt1 = parseFloat(v.paymentAmount1) || 0;
  const amt2 = parseFloat(v.paymentAmount2) || 0;
  if (amt1 <= 0 || amt2 <= 0) {
    return "Informe os valores de cada método (mínimo R$ 0,01).";
  }
  const total = parseFloat(v.totalAmount) || 0;
  if (total > 0 && Math.abs(amt1 + amt2 - total) > 0.01) {
    return "A soma dos valores deve ser igual ao total do pedido.";
  }
  return null;
}

/** Convert split payment form value → API payload. */
export function splitPaymentToPayload(v: SplitPaymentValue) {
  const total = parseFloat(v.totalAmount) || 0;
  const amt1 = parseFloat(v.paymentAmount1) || 0;
  const amt2 = parseFloat(v.paymentAmount2) || 0;
  const change1 = parseFloat(v.changeFor) || 0;
  const change2 = parseFloat(v.changeFor2) || 0;

  if (v.isSplit) {
    return {
      payment_method: v.paymentMethod || null,
      payment_method_2: v.paymentMethod2 || null,
      payment_amount_1: amt1 > 0 ? amt1 : null,
      payment_amount_2: amt2 > 0 ? amt2 : null,
      total_amount: total > 0 ? total : null,
      change_for: v.paymentMethod === "cash" && change1 > 0 ? change1 : null,
      change_for_2: v.paymentMethod2 === "cash" && change2 > 0 ? change2 : null,
      is_split_payment: true,
    };
  }
  return {
    payment_method: v.paymentMethod || null,
    payment_method_2: null,
    payment_amount_1: null,
    payment_amount_2: null,
    total_amount: total > 0 ? total : null,
    change_for: v.paymentMethod === "cash" && change1 > 0 ? change1 : null,
    change_for_2: null,
    is_split_payment: false,
  };
}

/** Build a SplitPaymentValue from an order row. */
export function splitPaymentFromOrder(o: {
  payment_method?: string | null;
  payment_method_2?: string | null;
  payment_amount_1?: number | null;
  payment_amount_2?: number | null;
  total_amount?: number | null;
  change_for?: number | null;
  change_for_2?: number | null;
  is_split_payment?: boolean | null;
}): SplitPaymentValue {
  return {
    isSplit: !!o.is_split_payment,
    paymentMethod: o.payment_method || "",
    paymentMethod2: o.payment_method_2 || "",
    totalAmount: o.total_amount != null ? String(o.total_amount) : "",
    paymentAmount1: o.payment_amount_1 != null ? String(o.payment_amount_1) : "",
    paymentAmount2: o.payment_amount_2 != null ? String(o.payment_amount_2) : "",
    changeFor: o.change_for != null ? String(o.change_for) : "",
    changeFor2: o.change_for_2 != null ? String(o.change_for_2) : "",
  };
}
