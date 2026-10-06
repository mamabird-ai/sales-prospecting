import { IconSearch, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListFilter } from "@/lib/hooks/use-list-filter";
import { cn } from "@/lib/utils";

interface ListFilterBarProps<T> {
  filter: ListFilter<T>;
  placeholder: string;
}

/**
 * The list toolbar when nothing is selected: a search box and facet chips.
 * Chips show how many items match, so it doubles as a summary.
 */
export function ListFilterBar<T>({ filter, placeholder }: ListFilterBarProps<T>) {
  return (
    <>
      <div className="relative w-52 shrink-0">
        <IconSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={filter.query}
          onChange={(e) => filter.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") filter.setQuery("");
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-6 pl-7"
        />
      </div>

      {/* Chips scroll sideways in a narrow window instead of pushing the count off the bar */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {filter.facets.map((facet) => (
          <div
            key={facet.id}
            role="group"
            aria-label={facet.label}
            className="flex shrink-0 items-center gap-1 border-l border-white/5 pl-2"
          >
            {facet.options.map((option) => {
              const count = filter.counts[facet.id]?.[option.id] ?? 0;
              const pressed = filter.chosen[facet.id]?.includes(option.id) ?? false;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pressed}
                  disabled={count === 0 && !pressed}
                  onClick={() => filter.toggle(facet.id, option.id)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded px-2 text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40",
                    pressed
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {option.label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {filter.active && (
        <>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {filter.filtered.length} of {filter.total}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={filter.clear}
            className="text-muted-foreground"
          >
            <IconX />
            Clear
          </Button>
        </>
      )}
    </>
  );
}
