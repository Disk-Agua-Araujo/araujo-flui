import { describe, it, expect } from "vitest";
import { inPeriod, makePeriod, periodBounds, periodLabel, periodRange, shiftPeriod, type PeriodPreset } from "@/lib/period";

// Sexta, 16/10/2026, meio da tarde.
const now = new Date("2026-10-16T15:00:00");
const range = (preset: PeriodPreset, patch = {}) => periodRange({ ...makePeriod(preset), ...patch }, now);

describe("periodRange", () => {
  it("atalhos terminam hoje ou fecham o período anterior inteiro", () => {
    expect(range("all")).toEqual({});
    expect(range("today")).toEqual({ from: "2026-10-16", to: "2026-10-16" });
    expect(range("yesterday")).toEqual({ from: "2026-10-15", to: "2026-10-15" });
    expect(range("week")).toEqual({ from: "2026-10-12", to: "2026-10-16" });
    expect(range("last_week")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(range("last7")).toEqual({ from: "2026-10-10", to: "2026-10-16" });
    expect(range("month")).toEqual({ from: "2026-10-01", to: "2026-10-16" });
    expect(range("last_month")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(range("last30")).toEqual({ from: "2026-09-17", to: "2026-10-16" });
    expect(range("year")).toEqual({ from: "2026-01-01", to: "2026-10-16" });
  });

  it("modos de escolher cobrem o dia, a semana, o mês ou o ano inteiro", () => {
    expect(range("pick_day", { day: "2026-02-28" })).toEqual({ from: "2026-02-28", to: "2026-02-28" });
    // 01/01/2026 é quinta: a semana começa na segunda 29/12/2025.
    expect(range("pick_week", { day: "2026-01-01" })).toEqual({ from: "2025-12-29", to: "2026-01-04" });
    expect(range("pick_month", { month: "2024-02" })).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(range("pick_year", { year: "2025" })).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(range("range", { from: "2026-03-01", to: "" })).toEqual({ from: "2026-03-01", to: undefined });
  });

  it("setas andam pelo período escolhido, atravessando o ano", () => {
    expect(shiftPeriod({ ...makePeriod("pick_month"), month: "2026-01" }, -1).month).toBe("2025-12");
    expect(shiftPeriod({ ...makePeriod("pick_week"), day: "2026-12-30" }, 1).day).toBe("2027-01-06");
    expect(shiftPeriod({ ...makePeriod("pick_day"), day: "2026-03-01" }, -1).day).toBe("2026-02-28");
    expect(shiftPeriod({ ...makePeriod("pick_year"), year: "2026" }, 1).year).toBe("2027");
  });
});

describe("apoio", () => {
  it("inPeriod usa o dia local e inclui as duas pontas", () => {
    const r = { from: "2026-10-01", to: "2026-10-31" };
    expect(inPeriod(new Date("2026-10-31T23:30:00").toISOString(), r)).toBe(true);
    expect(inPeriod(new Date("2026-11-01T00:10:00").toISOString(), r)).toBe(false);
    expect(inPeriod("2020-01-01T00:00:00Z", {})).toBe(true);
  });

  it("periodBounds completa as pontas para o backend", () => {
    expect(periodBounds({}, now)).toEqual({ from: "2000-01-01", to: "2026-10-16" });
    expect(periodBounds({ from: "2026-01-01" }, now)).toEqual({ from: "2026-01-01", to: "2026-10-16" });
  });

  it("periodLabel", () => {
    expect(periodLabel({})).toBe("Todo o período");
    expect(periodLabel({ from: "2026-10-16", to: "2026-10-16" })).toBe("16/10/2026");
    expect(periodLabel({ from: "2026-10-12", to: "2026-10-18" })).toBe("12/10 a 18/10/2026");
    expect(periodLabel({ from: "2025-12-29", to: "2026-01-04" })).toBe("29/12/2025 a 04/01/2026");
    expect(periodLabel({ from: "2026-03-01" })).toBe("Desde 01/03/2026");
  });
});
