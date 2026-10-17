import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const calls: Record<string, unknown[][]> = {};
const track = (name: string, result: unknown) => async (...args: unknown[]) => {
  (calls[name] ??= []).push(args);
  return result;
};

vi.mock("@/services/admin-api", () => ({
  adminApi: new Proxy({}, {
    get: (_t, name: string) => {
      if (name === "getReportsSummary") return track(name, { summary: { total_orders: 0, delivered: 0, cancelled: 0, total_items: 0 }, revenue: [], products: [] });
      if (name === "getCashReport") return track(name, { byMethod: [], entries: [], total: 0, page: 0, pageSize: 50 });
      if (name === "listReceivables") return track(name, { rows: [], total: 0, page: 0, pageSize: 50, today: "2026-10-16", summary: {} });
      if (name === "getRiderDailyStats") return track(name, {});
      if (name === "listRiders") return async () => [{ id: "r1", label: "J", name: "João", active: true, sort_order: 0, created_at: "" }];
      if (name === "listOrders") return async () => ({ rows: [], total: 0, page: 0, pageSize: 200 });
      return async () => ({});
    },
  }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { CashReport } from "@/components/admin/CashReport";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { ReceivablesTab } from "@/components/admin/ReceivablesTab";
import { OrdersTab } from "@/components/admin/OrdersTab";

/** Abre o filtro que está mostrando `current` e escolhe `label`. */
function choose(current: string, label: string, index = 0) {
  const trigger = screen.getAllByText(current, { selector: "span" })
    .map((el) => el.closest("button"))
    .filter(Boolean)[index]!;
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: label }));
}

const lastCall = (name: string) => calls[name]?.[calls[name].length - 1];

describe("o mesmo filtro de período em todo o painel", () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00")); });
  afterAll(() => { vi.useRealTimers(); });
  beforeEach(() => { for (const k of Object.keys(calls)) delete calls[k]; });

  it("Caixa: mês passado vai de 01/09 a 30/09", async () => {
    render(<CashReport />);
    await waitFor(() => expect(lastCall("getCashReport")).toBeTruthy());
    expect(lastCall("getCashReport")![0]).toMatchObject({ dateStart: "2026-10-01", dateEnd: "2026-10-16" });

    choose("Este mês", "Mês passado");
    await waitFor(() => expect(lastCall("getCashReport")![0]).toMatchObject({ dateStart: "2026-09-01", dateEnd: "2026-09-30" }), { timeout: 2000 });
  });

  it("Relatórios: vendas e faturamento filtram cada um no seu período", async () => {
    render(<ReportsTab />);
    await waitFor(() => expect(calls.getReportsSummary?.length).toBe(2));

    choose("Este mês", "Escolher ano", 0);
    await waitFor(() => expect(lastCall("getReportsSummary")).toEqual(["2026-01-01", "2026-12-31"]), { timeout: 2000 });
    fireEvent.click(screen.getByTitle("Ano anterior"));
    await waitFor(() => expect(lastCall("getReportsSummary")).toEqual(["2025-01-01", "2025-12-31"]), { timeout: 2000 });

    choose("Este mês", "Semana passada");
    await waitFor(() => expect(lastCall("getReportsSummary")).toEqual(["2026-10-05", "2026-10-11"]), { timeout: 2000 });
    expect(screen.getByText("Exibindo: 05/10 a 11/10/2026")).toBeInTheDocument();
  });

  it("Receber: recebidos de um dia escolhido", async () => {
    render(<ReceivablesTab />);
    fireEvent.click(await screen.findByText("Recebidos"));
    await waitFor(() => expect(lastCall("listReceivables")![0]).toMatchObject({ view: "paid", dateStart: "2026-10-01", dateEnd: "2026-10-16" }), { timeout: 2000 });

    choose("Este mês", "Escolher dia");
    fireEvent.click(screen.getByTitle("Dia anterior"));
    await waitFor(() => expect(lastCall("listReceivables")![0]).toMatchObject({ dateStart: "2026-10-15", dateEnd: "2026-10-15" }), { timeout: 2000 });
  });

  it("Motoboys: estatísticas com início e fim do período", async () => {
    render(<MemoryRouter><OrdersTab /></MemoryRouter>);
    fireEvent.click(await screen.findByTitle("Gerenciar motoboys"));
    await waitFor(() => expect(lastCall("getRiderDailyStats")).toEqual([["r1"], "2026-10-01", "2026-10-16"]), { timeout: 2000 });

    choose("Este mês", "Escolher mês");
    fireEvent.click(screen.getByTitle("Mês anterior"));
    await waitFor(() => expect(lastCall("getRiderDailyStats")).toEqual([["r1"], "2026-09-01", "2026-09-30"]), { timeout: 2000 });
    expect(screen.queryByText(/^Hoje:/)).not.toBeInTheDocument();
  });
});
