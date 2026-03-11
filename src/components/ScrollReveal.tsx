import { ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

type Animation = "fadeUp" | "fadeIn" | "fadeLeft" | "fadeRight" | "scaleUp" | "scaleX";

interface ScrollRevealProps {
  children: ReactNode;
  animation?: Animation;
  delay?: number;
  threshold?: number;
  className?: string;
  as?: "div" | "span";
}

const hiddenStyles: Record<Animation, string> = {
  fadeUp: "opacity-0 translate-y-6",
  fadeIn: "opacity-0",
  fadeLeft: "opacity-0 -translate-x-6",
  fadeRight: "opacity-0 translate-x-6",
  scaleUp: "opacity-0 scale-95",
  scaleX: "opacity-0 origin-left scale-x-0",
};

const visibleStyles: Record<Animation, string> = {
  fadeUp: "opacity-100 translate-y-0",
  fadeIn: "opacity-100",
  fadeLeft: "opacity-100 translate-x-0",
  fadeRight: "opacity-100 translate-x-0",
  scaleUp: "opacity-100 scale-100",
  scaleX: "opacity-100 scale-x-100",
};

export function ScrollReveal({
  children,
  animation = "fadeUp",
  delay = 0,
  threshold = 0.15,
  className,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal({ threshold, delay });

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[600ms] ease-out",
        isVisible
          ? `${visibleStyles[animation]} will-change-auto`
          : `${hiddenStyles[animation]} will-change-[transform,opacity]`,
        className
      )}
    >
      {children}
    </div>
  );
}
