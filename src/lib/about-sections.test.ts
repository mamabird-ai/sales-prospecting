import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { coverage, createSection, parseSections, serializeSections } from "./about-sections";

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

describe("serializeSections", () => {
  test("round-trips the design partner template layout", () => {
    const text = "## What we're building\n\nMamabird.\n\n## Where we are\n\nEarly: [beta].\n";
    expect(serializeSections(parseSections(text))).toBe(text);
  });

  test("round-trips the shipped design partner overview template unchanged", () => {
    const template = readFileSync(
      new URL(
        "../../src-tauri/src/prompts/templates/design_partners/company_overview.md",
        import.meta.url
      ),
      "utf8"
    );
    // Otherwise opening the page would show unsaved changes straight away
    expect(serializeSections(parseSections(template))).toBe(template);
  });

  test("gives untitled text after another section a heading so it stays separate", () => {
    const sections = [
      { ...createSection("Where we are"), body: "Beta" },
      { ...createSection(""), body: "Extra context" },
    ];
    const text = serializeSections(sections);
    expect(text).toBe("## Where we are\n\nBeta\n\n## Notes\n\nExtra context\n");
    expect(strip(parseSections(text))).toHaveLength(2);
  });

  test("drops empty untitled sections", () => {
    expect(serializeSections([createSection("")])).toBe("");
  });
});

describe("coverage", () => {
  test("marks topics as written, needing details, or missing", () => {
    const sections = parseSections(
      "## What we're building\n\nMamabird.\n\n## The problem it solves\n\n[Describe the pain]\n"
    );
    const byTopic = Object.fromEntries(
      coverage(sections).map(({ suggestion, status }) => [suggestion.covers, status])
    );
    expect(byTopic).toEqual({
      "What you're building": "written",
      "The problem it solves": "needs-details",
      "Who's a great fit": "missing",
      "Who isn't a fit": "missing",
    });
  });

  test("counts an untitled opening paragraph as describing what you're building", () => {
    const [building, problem] = coverage(parseSections("We sell a SaaS platform for PMs."));
    expect(building.status).toBe("written");
    expect(problem.status).toBe("missing");
  });
});
