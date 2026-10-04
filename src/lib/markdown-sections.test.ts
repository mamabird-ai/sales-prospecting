import { describe, expect, test } from "bun:test";

import { parseSections } from "./markdown-sections";

const strip = (sections: ReturnType<typeof parseSections>) =>
  sections.map(({ title, body }) => ({ title, body }));

describe("parseSections", () => {
  test("splits Markdown on ## headings", () => {
    const sections = parseSections(
      "## What we're building\n\nMamabird helps PMs.\n\n## Who is not a fit\n\n- Enterprises\n"
    );
    expect(strip(sections)).toEqual([
      { title: "What we're building", body: "Mamabird helps PMs." },
      { title: "Who is not a fit", body: "- Enterprises" },
    ]);
  });

  test("keeps text without headings as one untitled section", () => {
    expect(strip(parseSections("We sell a SaaS platform."))).toEqual([
      { title: "", body: "We sell a SaaS platform." },
    ]);
  });

  test("keeps text before the first heading", () => {
    expect(strip(parseSections("Intro line\n\n## Where we are\n\nBeta"))).toEqual([
      { title: "", body: "Intro line" },
      { title: "Where we are", body: "Beta" },
    ]);
  });

  test("returns nothing for empty text", () => {
    expect(parseSections("  \n")).toEqual([]);
  });
});
