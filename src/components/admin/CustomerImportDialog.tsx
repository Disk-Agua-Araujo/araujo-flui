import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type CustomerImportResult } from "@/services/admin-api";
import {
  IMPORT_FIELDS, findHeaderRow, guessMapping, prepareRows, readSheet,
  type ImportField, type Mapping, type PreparedRow,
} from "@/lib/customer-import";

// A busca de quem já existe vai na URL do PostgREST; 50 linhas mantém a URL bem abaixo de 8 KB.
const BATCH = 50;

type Step = "file" | "map" | "review" | "done";

type ReviewRow = PreparedRow & { result?: CustomerImportResult };

const ADDRESS_LABEL: Record<string, string> = {
  nova: "endereço novo",
  adicional: "endereço adicional",
  existente: "endereço já cadastrado",
  sem: "sem endereço",
};

/** Envia as linhas em lotes e devolve o resultado de cada uma, na ordem. */
async function runBatches(rows: PreparedRow[], dryRun: boolean, onProgress: (done: number) => void) {
  const results: CustomerImportResult[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { results: r } = await adminApi.importCustomers(batch.map((b) => b.row), dryRun);
    results.push(...r.map((x) => ({ ...x, index: x.index + i })));
    onProgress(Math.min(i + BATCH, rows.length));
  }
  return results;
}

export function CustomerImportDialog({
  open, onOpenChange, onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const headers = data[headerRow] ?? [];
  const sample = data.slice(headerRow + 1).find((r) => r.some(Boolean)) ?? [];

  const reset = () => {
    setStep("file"); setFileName(""); setData([]); setHeaderRow(0);
    setMapping({}); setReview([]); setBusy(false); setProgress(0);
  };

  const handleOpenChange = (o: boolean) => {
    if (busy) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await readSheet(file);
      const header = findHeaderRow(rows);
      if (rows.length <= header + 1) throw new Error("A planilha não tem linhas de clientes.");
      setFileName(file.name);
      setData(rows);
      setHeaderRow(header);
      setMapping(guessMapping(rows[header]));
      setStep("map");
    } catch (err) {
      toast({ title: "Não foi possível ler a planilha", description: err instanceof Error ? err.message : "Use um arquivo .xlsx, .xls ou .csv.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toSend = review.filter((r) => r.duplicateOf === undefined);

  const handleReview = async () => {
    const prepared = prepareRows(data, headerRow, mapping);
    const sendable = prepared.filter((r) => r.duplicateOf === undefined);
    setBusy(true);
    setProgress(0);
    try {
      const results = await runBatches(sendable, true, setProgress);
      let k = 0;
      setReview(prepared.map((r) => (r.duplicateOf === undefined ? { ...r, result: results[k++] } : r)));
      setStep("review");
    } catch (err) {
      toast({ title: "Erro ao conferir", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setProgress(0);
    try {
      const results = await runBatches(toSend, false, setProgress);
      let k = 0;
      setReview((prev) => prev.map((r) => (r.duplicateOf === undefined ? { ...r, result: results[k++] } : r)));
      setStep("done");
      onImported();
    } catch (err) {
      toast({
        title: "A importação parou no meio",
        description: `${err instanceof Error ? err.message : "Erro"}. Os lotes anteriores já foram gravados; importar de novo não duplica ninguém.`,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const count = (action: CustomerImportResult["action"]) => review.filter((r) => r.result?.action === action).length;
  const duplicates = review.filter((r) => r.duplicateOf !== undefined).length;
  const issues = review.filter((r) => r.duplicateOf !== undefined || r.warnings.length > 0 || r.result?.action === "skip");
  const toWrite = count("insert") + count("update");

  const summary = (
    <div className="flex flex-wrap gap-2 text-sm">
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{count("insert")} novos</Badge>
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{count("update")} completados</Badge>
      <Badge variant="secondary">{count("skip")} sem mudança</Badge>
      {duplicates > 0 && <Badge variant="outline">{duplicates} repetidos na planilha</Badge>}
    </div>
  );

  const issueList = issues.length > 0 && (
    <div className="border rounded-md max-h-64 overflow-y-auto divide-y text-xs">
      {issues.map((r) => (
        <div key={r.line} className="p-2">
          <span className="font-medium">Linha {r.line}</span>
          {r.row.name && <span className="text-muted-foreground"> · {r.row.name}</span>}
          {r.duplicateOf !== undefined && <p className="text-muted-foreground">Repetida da linha {r.duplicateOf}, não será importada.</p>}
          {r.result?.reason && <p className="text-muted-foreground">{r.result.reason}</p>}
          {r.warnings.map((w) => <p key={w} className="text-amber-700">{w}</p>)}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar clientes de planilha</DialogTitle></DialogHeader>

        {step === "file" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Use um arquivo Excel (.xlsx ou .xls) ou CSV com um cliente por linha e o nome das colunas na primeira linha.
              Antes de gravar, o sistema mostra quem é novo e quem já está cadastrado.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/40">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />}
              <span className="font-medium">{busy ? "Lendo a planilha..." : "Escolher arquivo"}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </label>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">{fileName}</strong>: {data.length - headerRow - 1} linhas.
              Confira de qual coluna vem cada dado. Os palpites já vêm preenchidos.
            </p>
            <div className="space-y-2">
              {IMPORT_FIELDS.map((f) => {
                const col = mapping[f.key];
                return (
                  <div key={f.key} className="grid grid-cols-[130px_1fr] items-center gap-2">
                    <span className="text-xs font-medium">{f.label}</span>
                    <div>
                      <Select
                        value={col === undefined ? "none" : String(col)}
                        onValueChange={(v) => setMapping((prev) => {
                          const next = { ...prev };
                          if (v === "none") delete next[f.key as ImportField];
                          else next[f.key as ImportField] = Number(v);
                          return next;
                        })}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não importar</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {col !== undefined && sample[col] && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Ex.: {sample[col]}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {busy && <Progress value={(progress / Math.max(1, data.length - headerRow - 1)) * 100} className="h-2" />}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>Trocar arquivo</Button>
              <Button onClick={handleReview} disabled={busy || mapping.name === undefined}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Conferir
              </Button>
            </div>
            {mapping.name === undefined && <p className="text-xs text-destructive">Escolha a coluna do nome para continuar.</p>}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Prévia: nada foi gravado ainda.</p>
            {summary}
            <p className="text-xs text-muted-foreground">
              Cliente que já existe (achado pelo CPF/CNPJ ou telefone) só ganha o que estiver vazio no cadastro. Nenhum dado atual é sobrescrito.
            </p>
            {issueList}
            {busy && <Progress value={(progress / Math.max(1, toSend.length)) * 100} className="h-2" />}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep("map")} disabled={busy}>Voltar</Button>
              <Button onClick={handleImport} disabled={busy || toWrite === 0}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {toWrite === 0 ? "Nada para importar" : `Importar ${toWrite} ${toWrite === 1 ? "cliente" : "clientes"}`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Importação concluída.</p>
            {summary}
            {review.some((r) => r.result?.address && r.result.address !== "sem") && (
              <p className="text-xs text-muted-foreground">
                {review.filter((r) => r.result?.address === "nova" || r.result?.address === "adicional").length} endereços gravados
                ({ADDRESS_LABEL.adicional} quando o cliente já tinha outro).
              </p>
            )}
            {issueList}
            <Button className="w-full" onClick={() => handleOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
