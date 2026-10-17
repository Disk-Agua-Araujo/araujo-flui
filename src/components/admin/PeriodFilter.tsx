import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MONTH_NAMES, PERIOD_PICK, PERIOD_QUICK, periodLabel, periodRange, shiftPeriod,
  type PeriodPreset, type PeriodValue,
} from "@/lib/period";

const ARROW_TITLES: Partial<Record<PeriodPreset, [string, string]>> = {
  pick_day: ["Dia anterior", "Próximo dia"],
  pick_week: ["Semana anterior", "Próxima semana"],
  pick_month: ["Mês anterior", "Próximo mês"],
  pick_year: ["Ano anterior", "Próximo ano"],
};

/**
 * Filtro de período padrão do painel: atalhos (hoje, semana passada, mês
 * passado...) e modos de escolher qualquer dia, semana, mês, ano ou intervalo.
 */
export function PeriodFilter({
  value, onChange, allowAll = true, minYear,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  /** Mostra a opção "Todos" (sem filtro de data). */
  allowAll?: boolean;
  /** Primeiro ano do seletor; sem ele, cinco anos para trás. */
  minYear?: number;
}) {
  const { preset } = value;
  const range = periodRange(value);
  const arrows = ARROW_TITLES[preset];
  const isQuick = PERIOD_QUICK.some((q) => q.value === preset);

  const current = new Date().getFullYear();
  const picked = Number(value.year || current);
  const pickedFromMonth = Number(value.month.slice(0, 4) || current);
  const newest = Math.max(current, picked, pickedFromMonth);
  const oldest = Math.min(minYear ?? current - 5, picked, pickedFromMonth);
  const years = Array.from({ length: newest - oldest + 1 }, (_, i) => String(newest - i));

  const set = (patch: Partial<PeriodValue>) => onChange({ ...value, ...patch });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => set({ preset: v as PeriodPreset })}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Período" /></SelectTrigger>
        {/* Lista longa: usa a altura que a tela tiver, para os dois grupos aparecerem sem rolar */}
        <SelectContent className="max-h-[min(40rem,var(--radix-select-content-available-height))]">
          {allowAll && <SelectItem value="all">Período: Todos</SelectItem>}
          <SelectGroup>
            <SelectLabel>Atalhos</SelectLabel>
            {PERIOD_QUICK.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Escolher</SelectLabel>
            {PERIOD_PICK.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Setas e controle do meio num grupo só, para quebrarem de linha juntos no celular */}
      {arrows && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onChange(shiftPeriod(value, -1))} title={arrows[0]}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {preset === "pick_day" && (
            <Input type="date" className="w-[160px]" value={value.day} onChange={(e) => { if (e.target.value) set({ day: e.target.value }); }} />
          )}

          {preset === "pick_week" && (
            <span className="text-sm font-medium min-w-[150px] text-center">{periodLabel(range)}</span>
          )}

          {preset === "pick_month" && (
            <>
              <Select value={value.month.slice(5, 7)} onValueChange={(m) => set({ month: `${value.month.slice(0, 4)}-${m}` })}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={value.month.slice(0, 4)} onValueChange={(y) => set({ month: `${y}-${value.month.slice(5, 7)}` })}>
                <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}

          {preset === "pick_year" && (
            <Select value={value.year} onValueChange={(y) => set({ year: y })}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onChange(shiftPeriod(value, 1))} title={arrows[1]}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {preset === "pick_week" && (
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          Semana do dia
          <Input type="date" className="w-[160px]" value={value.day} onChange={(e) => { if (e.target.value) set({ day: e.target.value }); }} />
        </label>
      )}

      {preset === "range" && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">De</span>
          <Input type="date" className="w-[160px]" value={value.from} onChange={(e) => set({ from: e.target.value })} />
          <span className="text-muted-foreground">até</span>
          <Input type="date" className="w-[160px]" value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
      )}

      {isQuick && <span className="text-xs text-muted-foreground">{periodLabel(range)}</span>}
    </div>
  );
}
