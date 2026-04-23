import { Star } from "lucide-react";
import { RatingBreakdown } from "@/types/portfolio";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StarRatingProps {
  rating: number;
  breakdown?: RatingBreakdown;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "fill-star text-star" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export function StarRating({ rating, breakdown }: StarRatingProps) {
  if (!breakdown) {
    return <Stars rating={rating} />;
  }
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help"
          aria-label={`Rating ${rating} de 5, score ${breakdown.total.toFixed(0)} de 100`}
        >
          <Stars rating={rating} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs p-2">
        <div className="font-mono-display text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-1">
            <span className="font-semibold">Rating {rating}/5</span>
            <span className="text-muted-foreground">
              score {breakdown.total.toFixed(0)}/100
            </span>
          </div>
          <ul className="space-y-1">
            {breakdown.items.map((it) => (
              <li
                key={it.key}
                className={`flex items-center justify-between gap-3 ${
                  it.enabled ? "" : "opacity-40 line-through"
                }`}
              >
                <div className="flex flex-col">
                  <span>{it.label}</span>
                  <span className="text-[10px] text-muted-foreground">{it.detail}</span>
                </div>
                <span className="tabular-nums whitespace-nowrap">
                  {it.score.toFixed(1)} / {it.weight.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
