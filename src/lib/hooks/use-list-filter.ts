import { useCallback, useMemo, useState } from "react";

/** One chip in a facet, e.g. "Strong fit" */
export interface FilterOption<T> {
  id: string;
  label: string;
  matches: (item: T) => boolean;
}

/** A group of chips that filter on one attribute, e.g. fit or research state */
export interface FilterFacet<T> {
  id: string;
  label: string;
  options: FilterOption<T>[];
}

interface UseListFilterOptions<T> {
  /** Text the search box matches against, e.g. name, title, and company */
  searchText: (item: T) => (string | null | undefined)[];
  facets: FilterFacet<T>[];
}

export interface ListFilter<T> {
  query: string;
  setQuery: (query: string) => void;
  facets: FilterFacet<T>[];
  /** Chosen option ids per facet. Options in a facet are ORed; facets are ANDed. */
  chosen: Record<string, string[]>;
  toggle: (facetId: string, optionId: string) => void;
  clear: () => void;
  /** Whether anything is hiding items right now */
  active: boolean;
  /** How many items match each option, ignoring the search box and other facets */
  counts: Record<string, Record<string, number>>;
  filtered: T[];
  total: number;
}

/**
 * The items that survive the search box and the chosen chips. Every word
 * typed must appear in an item's text; within a facet any chosen chip is
 * enough, and every facet with a choice must agree.
 */
export function applyListFilter<T>(
  items: T[],
  query: string,
  chosen: Record<string, string[]>,
  facets: FilterFacet<T>[],
  searchText: (item: T) => (string | null | undefined)[]
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const activeFacets = facets
    .map((facet) => ({
      options: facet.options.filter((option) => chosen[facet.id]?.includes(option.id)),
    }))
    .filter((facet) => facet.options.length > 0);
  if (words.length === 0 && activeFacets.length === 0) return items;

  return items.filter((item) => {
    if (words.length > 0) {
      const text = searchText(item)
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .toLowerCase();
      if (!words.every((word) => text.includes(word))) return false;
    }
    return activeFacets.every((facet) => facet.options.some((option) => option.matches(item)));
  });
}

/**
 * Narrow a list with a search box and facet chips. The list it returns is
 * what the page renders, so Select all picks only what's shown.
 */
export function useListFilter<T>(
  items: T[],
  { searchText, facets }: UseListFilterOptions<T>
): ListFilter<T> {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string[]>>({});

  const toggle = useCallback((facetId: string, optionId: string) => {
    setChosen((current) => {
      const ids = current[facetId] ?? [];
      const next = ids.includes(optionId)
        ? ids.filter((id) => id !== optionId)
        : [...ids, optionId];
      return { ...current, [facetId]: next };
    });
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setChosen({});
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const facet of facets) {
      result[facet.id] = {};
      for (const option of facet.options) {
        result[facet.id][option.id] = items.filter(option.matches).length;
      }
    }
    return result;
  }, [items, facets]);

  const filtered = useMemo(
    () => applyListFilter(items, query, chosen, facets, searchText),
    [items, query, chosen, facets, searchText]
  );

  return {
    query,
    setQuery,
    facets,
    chosen,
    toggle,
    clear,
    active: query.length > 0 || Object.values(chosen).some((ids) => ids.length > 0),
    counts,
    filtered,
    total: items.length,
  };
}
