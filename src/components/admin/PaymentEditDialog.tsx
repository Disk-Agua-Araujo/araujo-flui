import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type OrderPaymentPayload } from "@/services/admin-api";
import {
  SplitPaymentSection,
  splitPaymentFromOrder,
  splitPaymentToPayload,
  validateSplitPayment,
  type SplitPaymentValue,
} from "@/components/admin/SplitPaymentSection";

/** Pedido visto pela ótica do pagamento — serve tanto para Pedidos quanto para Receber. */
export type PaymentEditableOrder = {
  id: string;
  status: string;
  created_at: string;
  total_amount: number | null;
  payment_method: string | null;
  payment_method_2?: string | null;
  payment_amount_1?: number | null;
  payment_amount_2?: number | null;
  change_for?: number | null;
  change_for_2?: number | null;
  is_split_payment?: boolean | null;
  paid_at?: string | null;
  payment_due_date?: string | null;
  customers?: { name: string } | null;
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  agendado: "Agendado",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function formatCurrency(value: number | null) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Troca a forma de pagamento sem tocar em itens, endereço ou status.
 * Funciona em pedido já fechado: o que muda é só para onde o dinheiro é
 * contado no relatório de caixa.
 */
export function PaymentEditDialog({
  order, onOpenChange, onSaved,
}: {
  order: PaymentEditableOrder | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (payment: OrderPaymentPayload) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState<SplitPaymentValue>(() => splitPaymentFromOrder({}));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setValue(splitPaymentFromOrder(order));
  }, [order]);

  const handleSave = async () => {
    if (!order) return;

    if (!value.paymentMethod) {
      toast({
        title: "Selecione a forma de pagamento",
        description: "Sem ela o pedido não entra no relatório de caixa.",
        variant: "destructive",
      });
      return;
    }

    const splitError = validateSplitPayment(value);
    if (splitError) {
      toast({ title: "Pagamento dividido incompleto", description: splitError, variant: "destructive" });
      return;
    }

    const payload = splitPaymentToPayload(value);

    setSaving(true);
    try {
      await adminApi.updateOrderPayment(order.id, payload);
      toast({
        title: "Forma de pagamento atualizada.",
        description: "O relatório de caixa já reflete a mudança.",
      });
      onSaved?.(payload);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao alterar pagamento",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isFinalized = order?.status === "entregue" || order?.status === "cancelado";

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Alterar forma de pagamento</DialogTitle></DialogHeader>

        {order && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium truncate">{order.customers?.name || "Sem cadastro"}</p>
                <Badge variant="outline" className="text-xs shrink-0">
                  {statusLabels[order.status] || order.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">Criado em {formatDateTimeBR(order.created_at)}</p>
              {order.payment_due_date && (
                <p className="text-xs text-muted-foreground">
                  A prazo · vence em {formatDateBR(order.payment_due_date)}
                  {order.paid_at ? ` · recebido em ${formatDateBR(order.paid_at)}` : ""}
                </p>
              )}
              <p className="text-lg font-semibold">{formatCurrency(order.total_amount)}</p>
            </div>

            {isFinalized && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Pedido já fechado. A correção move o valor entre as formas de pagamento
                  na mesma data de caixa — nada muda de dia.
                </span>
              </div>
            )}

            <SplitPaymentSection value={value} onChange={setValue} compact />

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar pagamento
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
