import { useState, useEffect, KeyboardEvent, FocusEvent, ChangeEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  size = "md",
  className,
  ariaLabel,
}: QuantityInputProps) {
  const [text, setText] = useState<string>(String(value ?? 0));

  useEffect(() => {
    setText(String(value ?? 0));
  }, [value]);

  const clamp = (n: number) => Math.min(Math.max(min, n), max);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw === "") {
      setText("");
      return;
    }
    const num = clamp(parseInt(raw, 10));
    setText(String(num));
    onChange(num);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "" || isNaN(Number(e.target.value))) {
      setText(String(min));
      onChange(min);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const decrement = () => onChange(clamp((value ?? 0) - 1));
  const increment = () => onChange(clamp((value ?? 0) + 1));

  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const inputSize = size === "sm" ? "h-7 w-12 text-sm" : "h-8 w-16 text-sm";

  return (
    <div className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        onClick={decrement}
        disabled={(value ?? 0) <= min}
        aria-label="Diminuir"
        className={cn(
          btnSize,
          "rounded-l-md border border-r-0 border-input bg-background flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel ?? "Quantidade"}
        className={cn(
          inputSize,
          "border border-input bg-background text-center font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring focus:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />
      <button
        type="button"
        onClick={increment}
        disabled={(value ?? 0) >= max}
        aria-label="Aumentar"
        className={cn(
          btnSize,
          "rounded-r-md border border-l-0 border-input bg-background flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
