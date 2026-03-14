import { useState } from "react";
import { Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-full w-full",
} as const;

const iconSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

interface ProductImageProps {
  imageUrl?: string | null;
  productName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProductImage({ imageUrl, productName, size = "md", className }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-[#EDF4FF] aspect-square flex-shrink-0",
          sizeClasses[size],
          className
        )}
      >
        <Droplets className={cn("text-[#033D7B]", iconSizes[size])} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={productName}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn(
        "rounded-lg object-cover aspect-square flex-shrink-0",
        sizeClasses[size],
        className
      )}
    />
  );
}
