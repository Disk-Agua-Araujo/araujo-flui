// Entradas e saídas de dinheiro do Disk (balanço). As chaves batem com
// FINANCE_CATEGORIES da edge function admin-panel.

import type { FinanceEntry, FinanceKind } from "@/services/admin-api";

export const FINANCE_CATEGORIES: Record<FinanceKind, { key: string; label: string }[]> = {
  saida: [
    { key: "fornecedor", label: "Fornecedor (mercadoria)" },
    { key: "combustivel", label: "Combustível" },
    { key: "salarios", label: "Salários e diárias" },
    { key: "aluguel", label: "Aluguel" },
    { key: "contas", label: "Contas (luz, água, internet, telefone)" },
    { key: "manutencao", label: "Manutenção (moto, carro, equipamento)" },
    { key: "impostos", label: "Impostos e taxas" },
    { key: "outras_saidas", label: "Outras saídas" },
  ],
  entrada: [
    { key: "venda_avulsa", label: "Venda fora do sistema" },
    { key: "aporte", label: "Aporte (dinheiro colocado no caixa)" },
    { key: "outras_entradas", label: "Outras entradas" },
  ],
};

export function categoryLabel(kind: FinanceKind, key: string) {
  return FINANCE_CATEGORIES[kind].find((c) => c.key === key)?.label ?? key;
}

/** "1.234,56", "1234,5" ou "80" viram número; texto inválido vira NaN. */
export function parseMoney(text: string): number {
  const t = text.trim().replace(/^R\$\s*/, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return NaN;
  return Number(t.replace(/\./g, "").replace(",", "."));
}

const toCents = (n: number) => Math.round(n * 100);

export type FinanceSummary = {
  /** Vendas no regime de caixa (o mesmo número do relatório Caixa). */
  sales: number;
  /** Entradas lançadas à mão. */
  otherIn: number;
  totalIn: number;
  totalOut: number;
  /** Entradas menos saídas. */
  result: number;
  /** Saídas por categoria, da maior para a menor; share de 0 a 1. */
  outByCategory: { key: string; label: string; total: number; share: number }[];
};

export function summarizeFinance(sales: number, entries: FinanceEntry[]): FinanceSummary {
  let otherIn = 0;
  let totalOut = 0;
  const out = new Map<string, number>();
  for (const e of entries) {
    const c = toCents(e.amount);
    if (e.kind === "entrada") {
      otherIn += c;
    } else {
      totalOut += c;
      out.set(e.category, (out.get(e.category) ?? 0) + c);
    }
  }
  const totalIn = toCents(sales) + otherIn;
  return {
    sales,
    otherIn: otherIn / 100,
    totalIn: totalIn / 100,
    totalOut: totalOut / 100,
    result: (totalIn - totalOut) / 100,
    outByCategory: [...out.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, cents]) => ({
        key,
        label: categoryLabel("saida", key),
        total: cents / 100,
        share: totalOut ? cents / totalOut : 0,
      })),
  };
}
