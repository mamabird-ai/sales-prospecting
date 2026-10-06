import { IconCircleCheck, IconCircleDashed, IconCircleX } from "@tabler/icons-react";
import type { ResearchFit } from "@/lib/tauri/types";
import { cn } from "@/lib/utils";

const VERDICTS: Record<
  ResearchFit,
  { label: string; className: string; icon: typeof IconCircleCheck }
> = {
  strong: {
    label: "Fit confirmed",
    className: "bg-green-500/15 text-green-400",
    icon: IconCircleCheck,
  },
  possible: {
    label: "Possible fit",
    className: "bg-amber-500/10 text-amber-400",
    icon: IconCircleDashed,
  },
  unlikely: {
    label: "Not a fit",
    className: "bg-white/5 text-muted-foreground",
    icon: IconCircleX,
  },
};

/** Research's verdict on a person, so confirmed fits stand out in a list */
export function ResearchFitTag({ fit, className }: { fit: ResearchFit; className?: string }) {
  const verdict = VERDICTS[fit];
  const Icon = verdict.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px]",
        verdict.className,
        className
      )}
    >
      <Icon className="size-3" />
      {verdict.label}
    </span>
  );
}
