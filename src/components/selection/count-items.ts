import type { SelectionEntityType } from "@/lib/store/selection-store";

const ENTITY_NOUNS: Record<SelectionEntityType, [singular: string, plural: string]> = {
  lead: ["company", "companies"],
  person: ["person", "people"],
};

/** "1 company", "20 companies", "3 people" */
export function countItems(count: number, entityType: SelectionEntityType): string {
  const [singular, plural] = ENTITY_NOUNS[entityType];
  return `${count} ${count === 1 ? singular : plural}`;
}
