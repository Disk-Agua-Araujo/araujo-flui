import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type InvoiceFixes } from "@/services/admin-api";

// Sugestão inicial: o padrão das notas que a Lucindos já emite (NF-e 93:
// CFOP 5102 e CSOSN 102, Simples Nacional). PIS/COFINS 49 é o comum no
// Simples. Tudo editável; o contador confirma.
const SUGGESTED = { cfop: "5102", cst: "102", pis: "49" };

type ProductDraft = { ncm: string; cest: string; cfop: string; cst: string; pis: string; origem: string };

const onlyDigits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

/** "Completar agora": os dados fiscais que faltam para a nota, no próprio pedido. */
export function InvoiceFixForm({ orderId, fixes, onSaved }: { orderId: string; fixes: InvoiceFixes; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const priceItems = fixes.prices ?? [];
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, ProductDraft>>(() =>
    Object.fromEntries(fixes.products.map((p) => [p.id, {
      ncm: p.ncm ?? "",
      cest: p.cest ?? "",
      cfop: p.cfop || SUGGESTED.cfop,
      cst: p.cstCsosn || SUGGESTED.cst,
      pis: p.pisCofinsCst || SUGGESTED.pis,
      origem: String(p.origem ?? 0),
    }])),
  );
  const c = fixes.customer;
  const [cpf, setCpf] = useState(c?.cpf ?? "");
  const [cnpj, setCnpj] = useState(c?.cnpj ?? "");
  const [ie, setIe] = useState(c?.ie ?? "");
  const [exempt, setExempt] = useState(false);
  const [zip, setZip] = useState(fixes.address?.zip ?? "");

  const setProduct = (id: string, patch: Partial<ProductDraft>) =>
    setProducts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async () => {
    const priceValues = priceItems.map((p) => ({ product_id: p.productId, unit_price: Number((prices[p.productId] ?? "").replace(",", ".")) }));
    if (priceValues.some((p) => !Number.isFinite(p.unit_price) || p.unit_price <= 0)) {
      toast({ title: "Informe o preço de cada item", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await adminApi.fixInvoiceData({
        orderId,
        prices: priceValues,
        products: fixes.products.map((p) => {
          const d = products[p.id];
          return p.taxGroup
            ? { id: p.id, ncm: d.ncm, cest: d.cest }
            : { id: p.id, ncm: d.ncm, cest: d.cest, cfop: d.cfop, cst_csosn: d.cst, pis_cofins_cst: d.pis, origem: Number(d.origem) };
        }),
        customer: c ? {
          id: c.id,
          ...(c.needs.includes("cpf") ? { cpf } : {}),
          ...(c.needs.includes("cnpj") ? { cnpj } : {}),
          ...(c.needs.includes("ie") ? (exempt ? { ie: "", ie_indicator: 2 as const } : { ie, ie_indicator: 1 as const }) : {}),
        } : undefined,
        address: fixes.address ? { id: fixes.address.id, zip } : undefined,
      });
      toast({ title: "Cadastro completado" });
      onSaved();
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 space-y-3 text-xs">
      <p className="font-medium text-amber-900">Completar agora</p>

      {priceItems.map((p) => (
        <label key={p.productId} className="space-y-0.5 block">
          Preço unitário de {p.name} neste pedido ({p.qty} un.)
          <Input
            className="h-8"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={prices[p.productId] ?? ""}
            onChange={(e) => setPrices((prev) => ({ ...prev, [p.productId]: e.target.value.replace(/[^\d.,]/g, "") }))}
          />
        </label>
      ))}

      {fixes.products.map((p) => {
        const d = products[p.id];
        return (
          <div key={p.id} className="space-y-1">
            <p className="font-medium">{p.name}</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-0.5">NCM<Input className="h-8" inputMode="numeric" placeholder="8 dígitos" value={d.ncm} onChange={(e) => setProduct(p.id, { ncm: onlyDigits(e.target.value, 8) })} /></label>
              <label className="space-y-0.5">CEST (se houver)<Input className="h-8" inputMode="numeric" value={d.cest} onChange={(e) => setProduct(p.id, { cest: onlyDigits(e.target.value, 7) })} /></label>
              {!p.taxGroup && (
                <>
                  <label className="space-y-0.5">CFOP<Input className="h-8" inputMode="numeric" value={d.cfop} onChange={(e) => setProduct(p.id, { cfop: onlyDigits(e.target.value, 4) })} /></label>
                  <label className="space-y-0.5">CSOSN<Input className="h-8" inputMode="numeric" value={d.cst} onChange={(e) => setProduct(p.id, { cst: onlyDigits(e.target.value, 3) })} /></label>
                  <label className="space-y-0.5">CST PIS/COFINS<Input className="h-8" inputMode="numeric" value={d.pis} onChange={(e) => setProduct(p.id, { pis: onlyDigits(e.target.value, 2) })} /></label>
                  <label className="space-y-0.5">Origem<Input className="h-8" inputMode="numeric" value={d.origem} onChange={(e) => setProduct(p.id, { origem: onlyDigits(e.target.value, 1) })} /></label>
                </>
              )}
            </div>
          </div>
        );
      })}
      {fixes.products.some((p) => !p.taxGroup) && (
        <p className="text-muted-foreground">CFOP, CSOSN e PIS/COFINS já vêm com o padrão das notas que a Lucindos emite hoje. Confira o NCM de cada produto.</p>
      )}

      {c && (
        <div className="space-y-1">
          <p className="font-medium">{c.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {c.needs.includes("cpf") && (
              <label className="space-y-0.5">CPF<Input className="h-8" inputMode="numeric" value={cpf} onChange={(e) => setCpf(onlyDigits(e.target.value, 11))} /></label>
            )}
            {c.needs.includes("cnpj") && (
              <label className="space-y-0.5">CNPJ<Input className="h-8" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(onlyDigits(e.target.value, 14))} /></label>
            )}
            {c.needs.includes("ie") && (
              <div className="space-y-1">
                <label className="space-y-0.5 block">Inscrição estadual<Input className="h-8" inputMode="numeric" value={ie} disabled={exempt} onChange={(e) => setIe(onlyDigits(e.target.value, 14))} /></label>
                <label className="flex items-center gap-1.5">
                  <Checkbox checked={exempt} onCheckedChange={(v) => setExempt(v === true)} /> Não tem (isento)
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {fixes.address && (
        <label className="space-y-0.5 block">
          CEP de {fixes.address.label}
          <Input className="h-8" inputMode="numeric" placeholder="00000000" value={zip} onChange={(e) => setZip(onlyDigits(e.target.value, 8))} />
        </label>
      )}

      <Button size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar e conferir de novo
      </Button>
    </div>
  );
}
