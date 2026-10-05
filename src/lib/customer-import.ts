import { isValidCpf } from "@/lib/cpf";
import { isValidCnpj } from "@/lib/cnpj";
import { normalize } from "@/lib/normalize";

export type ImportField =
  | "name" | "phone" | "cpf" | "cnpj" | "ie" | "email"
  | "zip" | "street" | "number" | "neighborhood" | "city" | "state" | "complement" | "reference";

export const IMPORT_FIELDS: { key: ImportField; label: string; synonyms: string[] }[] = [
  { key: "name", label: "Nome *", synonyms: ["nome", "cliente", "razao social", "nome fantasia", "nome do cliente"] },
  { key: "phone", label: "Telefone", synonyms: ["telefone", "celular", "fone", "whatsapp", "tel", "contato"] },
  { key: "cpf", label: "CPF (ou CPF/CNPJ)", synonyms: ["cpf", "cpf cnpj", "documento", "doc"] },
  { key: "cnpj", label: "CNPJ", synonyms: ["cnpj"] },
  { key: "ie", label: "Inscrição estadual", synonyms: ["ie", "inscricao estadual", "insc estadual", "inscricao"] },
  { key: "email", label: "Email", synonyms: ["email", "e mail"] },
  { key: "zip", label: "CEP", synonyms: ["cep"] },
  { key: "street", label: "Rua", synonyms: ["rua", "logradouro", "endereco"] },
  { key: "number", label: "Número", synonyms: ["numero", "n", "no", "num", "nro"] },
  { key: "neighborhood", label: "Bairro", synonyms: ["bairro"] },
  { key: "city", label: "Cidade", synonyms: ["cidade", "municipio"] },
  { key: "state", label: "Estado (UF)", synonyms: ["uf", "estado"] },
  { key: "complement", label: "Complemento", synonyms: ["complemento", "compl"] },
  { key: "reference", label: "Ponto de referência", synonyms: ["referencia", "ponto de referencia"] },
];

export type Mapping = Partial<Record<ImportField, number>>;

/** Linha no formato que a ação customers.import espera. */
export type ImportRow = {
  name: string; phone?: string; cpf?: string; cnpj?: string; ie?: string; email?: string;
  address?: {
    street: string; number: string; neighborhood?: string; city?: string; state?: string;
    zip?: string; complement?: string; reference?: string;
  };
};

export type PreparedRow = {
  /** Número da linha na planilha, como o Excel mostra. */
  line: number;
  row: ImportRow;
  /** Problemas que não impedem a importação (o dado ruim fica de fora). */
  warnings: string[];
  /** Linha repetida na própria planilha: não é enviada. */
  duplicateOf?: number;
};

const headerKey = (h: string) => normalize(h).replace(/[^a-z0-9]+/g, " ").trim();

/** Lê a primeira aba de um .xlsx, .xls ou .csv como matriz de textos. */
export async function readSheet(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    // O SheetJS lê CSV como Latin-1 e estraga acento de arquivo UTF-8 (Google
    // Planilhas). Tenta UTF-8; se não for, é o Windows-1252 do Excel brasileiro.
    const bytes = new Uint8Array(buffer);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }
    wb = XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string" });
  } else {
    wb = XLSX.read(buffer, { type: "array" });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

/** A linha de cabeçalho é a primeira com pelo menos duas células preenchidas. */
export function findHeaderRow(data: string[][]): number {
  const idx = data.findIndex((r) => r.filter(Boolean).length >= 2);
  return idx === -1 ? 0 : idx;
}

/** Sugere a coluna de cada campo pelo nome do cabeçalho. */
export function guessMapping(headers: string[]): Mapping {
  const keys = headers.map(headerKey);
  const used = new Set<number>();
  const mapping: Mapping = {};
  for (const field of IMPORT_FIELDS) {
    let col = keys.findIndex((k, i) => !used.has(i) && field.synonyms.includes(k));
    if (col === -1) {
      col = keys.findIndex((k, i) => !used.has(i) && field.synonyms.some((s) => s.length > 2 && k.split(" ").includes(s)));
    }
    if (col !== -1) {
      mapping[field.key] = col;
      used.add(col);
    }
  }
  return mapping;
}

/** Excel apaga zero à esquerda de número: devolve os dígitos no tamanho certo. */
function padDoc(digits: string): string {
  if (digits.length === 9 || digits.length === 10) return digits.padStart(11, "0");
  if (digits.length === 12 || digits.length === 13) return digits.padStart(14, "0");
  return digits;
}

/** "Rua X, 123 - apto 4" vira rua, número e complemento. */
function splitStreet(value: string): { street: string; number: string; complement: string } | null {
  const m = value.match(/^(.+?),\s*(?:n[º°o.]?\s*)?(\d+[a-zA-Z]?)\b\s*(?:[-,]\s*(.*))?$/i);
  return m ? { street: m[1].trim(), number: m[2], complement: (m[3] ?? "").trim() } : null;
}

export function prepareRows(data: string[][], headerRow: number, mapping: Mapping): PreparedRow[] {
  const get = (r: string[], f: ImportField) => (mapping[f] !== undefined ? (r[mapping[f]!] ?? "").trim() : "");
  const prepared: PreparedRow[] = [];
  const seen = new Map<string, number>();

  data.slice(headerRow + 1).forEach((r, i) => {
    if (!r.some(Boolean)) return;
    const line = headerRow + i + 2;
    const warnings: string[] = [];
    const row: ImportRow = { name: get(r, "name") };

    const phone = get(r, "phone").replace(/\D/g, "");
    if (phone) row.phone = phone;

    for (const f of ["cpf", "cnpj"] as const) {
      const raw = get(r, f);
      if (!raw) continue;
      const digits = padDoc(raw.replace(/\D/g, ""));
      if (digits.length === 11 && isValidCpf(digits)) row.cpf = digits;
      else if (digits.length === 14 && isValidCnpj(digits)) row.cnpj = digits;
      else warnings.push(`Documento inválido (${raw}), importado sem ele.`);
    }

    const ie = get(r, "ie");
    if (ie) row.ie = ie;
    const email = get(r, "email");
    if (email) row.email = email;

    let street = get(r, "street");
    let number = get(r, "number");
    let complement = get(r, "complement");
    if (street && !number) {
      const split = splitStreet(street);
      if (split) {
        street = split.street;
        number = split.number;
        complement = complement || split.complement;
      }
    }
    const zipDigits = get(r, "zip").replace(/\D/g, "");
    const zip = zipDigits.length === 7 ? zipDigits.padStart(8, "0") : zipDigits;
    if (zipDigits && zip.length !== 8) warnings.push(`CEP inválido (${get(r, "zip")}), importado sem ele.`);

    if (street && number) {
      row.address = {
        street,
        number,
        neighborhood: get(r, "neighborhood"),
        city: get(r, "city"),
        state: get(r, "state"),
        zip: zip.length === 8 ? zip : undefined,
        complement: complement || undefined,
        reference: get(r, "reference") || undefined,
      };
    } else if (street || number) {
      warnings.push("Endereço sem rua ou sem número, importado sem endereço.");
    }

    const keys = [row.cpf && `cpf:${row.cpf}`, row.cnpj && `cnpj:${row.cnpj}`, row.phone && `tel:${row.phone}`].filter(Boolean) as string[];
    const dup = keys.map((k) => seen.get(k)).find((v) => v !== undefined);
    keys.forEach((k) => { if (!seen.has(k)) seen.set(k, line); });

    prepared.push({ line, row, warnings, duplicateOf: dup });
  });

  return prepared;
}
