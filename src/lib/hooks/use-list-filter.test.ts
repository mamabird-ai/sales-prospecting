import { describe, expect, test } from "bun:test";

import { applyListFilter, type FilterFacet } from "./use-list-filter";

type Person = { name: string; company: string | null; fit: "strong" | "possible" | null };

const people: Person[] = [
  { name: "Jane Doe", company: "Acme", fit: "strong" },
  { name: "Sam Lee", company: "Acme", fit: "possible" },
  { name: "Ana Ruiz", company: null, fit: null },
];

const facets: FilterFacet<Person>[] = [
  {
    id: "fit",
    label: "Fit",
    options: [
      { id: "strong", label: "Strong", matches: (p) => p.fit === "strong" },
      { id: "possible", label: "Possible", matches: (p) => p.fit === "possible" },
    ],
  },
  {
    id: "company",
    label: "Company",
    options: [{ id: "none", label: "No company", matches: (p) => p.company === null }],
  },
];

const searchText = (p: Person) => [p.name, p.company];
const names = (list: Person[]) => list.map((p) => p.name);

describe("list filtering", () => {
  test("returns everything when nothing is typed or chosen", () => {
    expect(applyListFilter(people, "", {}, facets, searchText)).toBe(people);
  });

  test("every typed word must appear, in any field, ignoring case", () => {
    expect(names(applyListFilter(people, "acme", {}, facets, searchText))).toEqual([
      "Jane Doe",
      "Sam Lee",
    ]);
    expect(names(applyListFilter(people, "Acme sam", {}, facets, searchText))).toEqual(["Sam Lee"]);
    expect(applyListFilter(people, "acme ruiz", {}, facets, searchText)).toEqual([]);
  });

  test("chips in one facet widen the match, chips across facets narrow it", () => {
    const either = { fit: ["strong", "possible"] };
    expect(names(applyListFilter(people, "", either, facets, searchText))).toEqual([
      "Jane Doe",
      "Sam Lee",
    ]);
    const both = { fit: ["strong"], company: ["none"] };
    expect(applyListFilter(people, "", both, facets, searchText)).toEqual([]);
  });

  test("a facet with every chip unpressed is ignored", () => {
    expect(applyListFilter(people, "", { fit: [] }, facets, searchText)).toBe(people);
  });
});
