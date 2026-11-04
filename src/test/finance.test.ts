import { describe, it, expect } from "vitest";
import { parseMoney, summarizeFinance } from "@/lib/finance";
import type { FinanceEntry } from "@/services/admin-api";

const entry = (over: Partial<FinanceEntry>): FinanceEntry => ({
  id: Math.random().toString(36), kind: "saida", category: "combustivel", description: null,
  amount: 10, entry_date: "2026-11-04", created_by: null, created_at: "", ...over,
});

describe("entradas e saídas", () => {
  it("lê valor do jeito brasileiro", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("80")).toBe(80);
    expect(parseMoney("R$ 12,5")).toBe(12.5);
    expect(parseMoney("12.5")).toBeNaN();
    expect(parseMoney("abc")).toBeNaN();
  });

  it("balanço: vendas mais entradas avulsas menos gastos", () => {
    const s = summarizeFinance(10000, [
      entry({ category: "fornecedor", amount: 4000.1 }),
      entry({ category: "combustivel", amount: 300 }),
      entry({ category: "combustivel", amount: 200.2 }),
      entry({ category: "salarios", amount: 3000 }),
      entry({ kind: "entrada", category: "aporte", amount: 500 }),
    ]);
    expect(s.totalIn).toBe(10500);
    expect(s.otherIn).toBe(500);
    expect(s.totalOut).toBe(7500.3);
    expect(s.result).toBe(2999.7);
    expect(s.outByCategory.map((c) => [c.key, c.total])).toEqual([
      ["fornecedor", 4000.1], ["salarios", 3000], ["combustivel", 500.2],
    ]);
    expect(s.outByCategory[0].label).toBe("Fornecedor (mercadoria)");
  });

  it("sem lançamento o resultado é o caixa", () => {
    expect(summarizeFinance(250, []).result).toBe(250);
  });
});
