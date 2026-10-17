import { format, startOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths, addYears } from "date-fns";

/**
 * Filtro de período usado em todo o painel. Datas são sempre "aaaa-mm-dd" no
 * horário local, e o intervalo é inclusivo nas duas pontas, igual ao backend.
 * Semana vai de segunda a domingo. "Este/esta" termina hoje.
 */
export type PeriodPreset =
  | "all"
  | "today" | "yesterday"
  | "week" | "last_week" | "last7"
  | "month" | "last_month" | "last30"
  | "year"
  | "pick_day" | "pick_week" | "pick_month" | "pick_year"
  | "range";

export type PeriodValue = {
  preset: PeriodPreset;
  /** Dia escolhido em "Escolher dia" e qualquer dia da semana em "Escolher semana". */
  day: string;
  /** "aaaa-mm" */
  month: string;
  /** "aaaa" */
  year: string;
  from: string;
  to: string;
};

export type PeriodRange = { from?: string; to?: string };

export const PERIOD_QUICK: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "week", label: "Esta semana" },
  { value: "last_week", label: "Semana passada" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "year", label: "Este ano" },
];

export const PERIOD_PICK: { value: PeriodPreset; label: string }[] = [
  { value: "pick_day", label: "Escolher dia" },
  { value: "pick_week", label: "Escolher semana" },
  { value: "pick_month", label: "Escolher mês" },
  { value: "pick_year", label: "Escolher ano" },
  { value: "range", label: "Entre datas" },
];

export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "aaaa-mm-dd" como meia-noite no horário local (new Date("aaaa-mm-dd") seria UTC). */
export function localDay(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function isoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function makePeriod(preset: PeriodPreset = "all"): PeriodValue {
  const now = new Date();
  return { preset, day: isoDay(now), month: format(now, "yyyy-MM"), year: format(now, "yyyy"), from: "", to: "" };
}

const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export function periodRange(p: PeriodValue, now = new Date()): PeriodRange {
  const today = isoDay(now);
  switch (p.preset) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = isoDay(addDays(now, -1)); return { from: y, to: y }; }
    case "week": return { from: isoDay(weekStart(now)), to: today };
    case "last_week": {
      const start = addDays(weekStart(now), -7);
      return { from: isoDay(start), to: isoDay(addDays(start, 6)) };
    }
    case "last7": return { from: isoDay(addDays(now, -6)), to: today };
    case "month": return { from: isoDay(startOfMonth(now)), to: today };
    case "last_month": {
      const start = startOfMonth(addMonths(now, -1));
      return { from: isoDay(start), to: isoDay(endOfMonth(start)) };
    }
    case "last30": return { from: isoDay(addDays(now, -29)), to: today };
    case "year": return { from: isoDay(startOfYear(now)), to: today };
    case "pick_day": return p.day ? { from: p.day, to: p.day } : {};
    case "pick_week": {
      if (!p.day) return {};
      const start = weekStart(localDay(p.day));
      return { from: isoDay(start), to: isoDay(addDays(start, 6)) };
    }
    case "pick_month": {
      if (!p.month) return {};
      const start = localDay(`${p.month}-01`);
      return { from: isoDay(start), to: isoDay(endOfMonth(start)) };
    }
    case "pick_year": {
      if (!p.year) return {};
      const start = localDay(`${p.year}-01-01`);
      return { from: isoDay(start), to: isoDay(endOfYear(start)) };
    }
    case "range": return { from: p.from || undefined, to: p.to || undefined };
    default: return {};
  }
}

/** O dia (local) de um timestamp está dentro do intervalo? */
export function inPeriod(timestamp: string, range: PeriodRange) {
  if (!range.from && !range.to) return true;
  const day = isoDay(new Date(timestamp));
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

/** Para o backend, que pede as duas pontas: sem início vale desde sempre, sem fim vale até hoje. */
export function periodBounds(range: PeriodRange, now = new Date()) {
  return { from: range.from ?? "2000-01-01", to: range.to ?? isoDay(now) };
}

/** "16/10/2026" ou "12/10 a 18/10/2026" (ano só no fim quando é o mesmo). */
export function periodLabel(range: PeriodRange) {
  const br = (iso: string) => iso.split("-").reverse().join("/");
  if (!range.from && !range.to) return "Todo o período";
  if (!range.from) return `Até ${br(range.to!)}`;
  if (!range.to) return `Desde ${br(range.from)}`;
  if (range.from === range.to) return br(range.from);
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${sameYear ? br(range.from).slice(0, 5) : br(range.from)} a ${br(range.to)}`;
}

/** Anda um dia, semana, mês ou ano para trás ou para frente no modo de escolher. */
export function shiftPeriod(p: PeriodValue, delta: number): PeriodValue {
  if (p.preset === "pick_day") return { ...p, day: isoDay(addDays(localDay(p.day), delta)) };
  if (p.preset === "pick_week") return { ...p, day: isoDay(addDays(localDay(p.day), delta * 7)) };
  if (p.preset === "pick_month") return { ...p, month: format(addMonths(localDay(`${p.month}-01`), delta), "yyyy-MM") };
  if (p.preset === "pick_year") return { ...p, year: format(addYears(localDay(`${p.year}-01-01`), delta), "yyyy") };
  return p;
}
