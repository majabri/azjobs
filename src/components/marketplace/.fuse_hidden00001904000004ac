import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizeMap = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };

export default function StarRating({ value, onChange, readonly = false, size = "md", showLabel = false }: Props) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5" onMouseLeave={() => !readonly && setHovered(0)}>
        {Array.from({ length: 5 }).map((_, i) => {
          const starVal = i + 1;
          return (
            <Star
              key={i}
              className={cn(
                sizeMap[size],
                "transition-colors",
                starVal <= display ? "fill-[#FFB800] text-[#FFB800]" : "text-muted-foreground/30",
                !readonly && "cursor-pointer hover:scale-110 transition-transform"
              )}
              onMouseEnter={() => !readonly && setHovered(starVal)}
              onClick={() => onChange?.(starVal)}
            />
          );
        })}
      </div>
      {showLabel && <span className="text-sm text-muted-foreground ml-1">{display} star{display !== 1 ? "s" : ""}</span>}
    </div>
  );
}
