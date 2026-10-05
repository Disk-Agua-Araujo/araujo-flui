import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { InvoiceFixForm } from "@/components/admin/InvoiceFixForm";
import { FileText, FileCode, Loader2, RefreshCw, Receipt, Ban, PenLine, Eye, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type InvoiceFixes, type InvoiceRow, type InvoiceSummary } from "@/services/admin-api";

type AnyInvoice = InvoiceSummary & Partial<InvoiceRow>;

/** Nota mais recente do pedido (as recusadas ficam como histórico). */
export function latestInvoice<T extends InvoiceSummary>(invoices: T[] | undefined): T | null {
  if (!invoices?.length) return null;
  return [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  autorizada: { label: "NF-e", className: "bg-green-100 text-green-800 border-green-300" },
  processando: { label: "NF-e processando", className: "bg-amber-100 text-amber-800 border-amber-300" },
  erro: { label: "Nota com erro", className: "bg-red-100 text-red-800 border-red-300" },
  cancelada: { label: "NF-e cancelada", className: "bg-muted text-muted-foreground" },
};

/** Selo da nota na lista de pedidos. Pedido sem nota não mostra nada. */
export function InvoiceBadge({ invoices }: { invoices?: InvoiceSummary[] }) {
  const inv = latestInvoice(invoices);
  if (!inv) return null;
  const s = STATUS_STYLE[inv.status];
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${s.className}`}>
      <Receipt className="h-3 w-3" />
      {s.label}{inv.status === "autorizada" && inv.numero ? ` ${inv.numero}` : ""}
      {inv.environment === 2 && " (teste)"}
    </Badge>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function InvoicePanel({
  orderId, invoices, onChange,
}: {
  orderId: string;
  invoices?: InvoiceSummary[];
  onChange: (invoice: InvoiceRow) => void;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState<AnyInvoice | null>(latestInvoice(invoices));
  const [problems, setProblems] = useState<string[] | null>(null);
  const [fixes, setFixes] = useState<InvoiceFixes | null>(null);
  const [checkKey, setCheckKey] = useState(0);
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [environment, setEnvironment] = useState<1 | 2 | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<"cancel" | "correct" | null>(null);
  const [text, setText] = useState("");
  const [sefaz, setSefaz] = useState<{ ok: boolean; message: string; detail: string } | null>(null);

  // Nota de teste (homologação) não impede emitir a nota real depois que o
  // sistema passa para produção.
  const canEmit = !current || current.status === "erro" || current.status === "cancelada"
    || (environment !== null && current.environment !== environment);

  useEffect(() => {
    setCurrent(latestInvoice(invoices));
  }, [invoices]);

  // Confere o cadastro e descobre o ambiente atual (teste ou produção).
  useEffect(() => {
    let cancelled = false;
    adminApi.checkInvoice(orderId)
      .then((r) => { if (!cancelled) { setProblems(r.problems); setEnvironment(r.environment); setFixes(r.fixes ?? null); } })
      .catch(() => { if (!cancelled) setProblems(null); });
    return () => { cancelled = true; };
  }, [orderId, current?.status, checkKey]);

  const hasFixes = !!fixes && (fixes.products.length > 0 || !!fixes.customer || !!fixes.address);

  const run = async (key: string, fn: () => Promise<InvoiceRow | void>) => {
    setBusy(key);
    try {
      const inv = await fn();
      if (inv) {
        setCurrent(inv);
        onChange(inv);
      }
    } catch (err) {
      toast({ title: "Não deu certo", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const emit = () => run("emit", async () => {
    const r = await adminApi.emitInvoice(orderId, purchaseOrder);
    if (r.problems) {
      setProblems(r.problems);
      return;
    }
    const inv = r.invoice!;
    if (inv.status === "autorizada") toast({ title: `Nota ${inv.numero ?? ""} autorizada` });
    return inv;
  });

  const pdf = (base64: string, filename: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    download(new Blob([bytes], { type: "application/pdf" }), filename);
  };

  const preview = () => run("preview", async () => {
    const r = await adminApi.previewInvoice(orderId, purchaseOrder);
    if (r.problems) {
      setProblems(r.problems);
      return;
    }
    pdf(r.base64 ?? "", r.filename ?? "previa.pdf");
  });

  const testSefaz = () => run("sefaz", async () => {
    setSefaz(await adminApi.sefazStatus());
  });

  const refresh = () => run("refresh", async () => (await adminApi.refreshInvoice(current!.id)).invoice);

  const submitForm = () => run(form!, async () => {
    const r = form === "cancel"
      ? await adminApi.cancelInvoice(current!.id, text)
      : await adminApi.correctInvoice(current!.id, text);
    setForm(null);
    setText("");
    toast({ title: form === "cancel" ? "Nota cancelada" : "Carta de correção registrada" });
    return r.invoice;
  });

  const getFile = (type: "xml" | "danfe") => run(type, async () => {
    const f = await adminApi.getInvoiceFile(current!.id, type);
    if (type === "xml") {
      download(new Blob([f.content ?? ""], { type: "application/xml" }), f.filename);
    } else {
      pdf(f.base64 ?? "", f.filename);
    }
  });

  const env = environment ?? current?.environment;

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-semibold flex items-center gap-1"><Receipt className="h-4 w-4" /> Nota fiscal</p>
        {env === 2 && <Badge variant="outline" className="text-xs">Homologação: teste sem valor fiscal</Badge>}
      </div>

      {current && (
        <div className="space-y-1">
          <InvoiceBadge invoices={[current]} />
          {current.status === "autorizada" && (
            <p className="text-xs text-muted-foreground">
              Nº {current.numero ?? "?"}{current.serie != null ? `, série ${current.serie}` : ""}
            </p>
          )}
          {current.message && (
            <p className={`text-xs ${current.status === "erro" ? "text-destructive" : "text-muted-foreground"}`}>{current.message}</p>
          )}
        </div>
      )}

      {canEmit && problems && problems.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 space-y-1">
          <p className="font-medium">Antes de emitir, acerte no cadastro:</p>
          <ul className="list-disc list-inside">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {canEmit && hasFixes && (
        <InvoiceFixForm key={checkKey} fixes={fixes!} onSaved={() => setCheckKey((k) => k + 1)} />
      )}

      {canEmit && problems && problems.length === 0 && (
        <label className="block text-xs space-y-0.5">
          <span className="text-muted-foreground">Nº do pedido de compra do cliente (opcional, sai na nota)</span>
          <Input className="h-8" value={purchaseOrder} maxLength={60} onChange={(e) => setPurchaseOrder(e.target.value)} />
        </label>
      )}

      <div className="flex gap-2 flex-wrap">
        {canEmit && (
          <Button size="sm" onClick={emit} disabled={!!busy || !problems || problems.length > 0}>
            {busy === "emit" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Receipt className="h-4 w-4 mr-1" />}
            {current ? "Emitir de novo" : "Emitir nota fiscal"}
          </Button>
        )}
        {canEmit && (
          <Button size="sm" variant="outline" onClick={preview} disabled={!!busy || !problems || problems.length > 0}>
            {busy === "preview" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
            Pré-visualizar
          </Button>
        )}
        {current?.status === "processando" && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={!!busy}>
            {busy === "refresh" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar status
          </Button>
        )}
        {current?.status === "autorizada" && (
          <>
            <Button size="sm" variant="outline" onClick={() => getFile("danfe")} disabled={!!busy}>
              {busy === "danfe" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} DANFE
            </Button>
            <Button size="sm" variant="outline" onClick={() => getFile("xml")} disabled={!!busy}>
              {busy === "xml" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileCode className="h-4 w-4 mr-1" />} XML
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(form === "correct" ? null : "correct"); setText(""); }} disabled={!!busy}>
              <PenLine className="h-4 w-4 mr-1" /> Carta de correção
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setForm(form === "cancel" ? null : "cancel"); setText(""); }} disabled={!!busy}>
              <Ban className="h-4 w-4 mr-1" /> Cancelar nota
            </Button>
          </>
        )}
      </div>

      {canEmit && (
        <div className="text-xs">
          <button type="button" className="text-muted-foreground underline inline-flex items-center gap-1 disabled:opacity-50" onClick={testSefaz} disabled={!!busy}>
            {busy === "sefaz" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            Testar conexão com a SEFAZ
          </button>
          {sefaz && (
            <p className={sefaz.ok ? "text-green-700 mt-1" : "text-destructive mt-1"}>
              {sefaz.ok ? "Conexão funcionando. " : "A conexão não está pronta. "}
              {sefaz.message}{sefaz.detail ? ` (${sefaz.detail})` : ""}
            </p>
          )}
        </div>
      )}

      {form && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs text-muted-foreground">
            {form === "cancel"
              ? "Motivo do cancelamento (mínimo 15 letras). A SEFAZ só aceita cancelar em até 24 horas da emissão."
              : "O que precisa ser corrigido (mínimo 15 letras). Carta de correção não muda valor, imposto nem destinatário."}
          </p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={form === "cancel" ? 255 : 1000} />
          <div className="flex gap-2">
            <Button size="sm" variant={form === "cancel" ? "destructive" : "default"} onClick={submitForm} disabled={!!busy || text.trim().length < 15}>
              {busy === form && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {form === "cancel" ? "Confirmar cancelamento" : "Enviar correção"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)} disabled={!!busy}>Voltar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
