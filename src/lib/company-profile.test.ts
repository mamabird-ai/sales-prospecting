import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { emptyProfile, parseProfile, serializeProfile } from "./company-profile";

describe("parseProfile", () => {
  test("maps the design partner template's headings onto fields", () => {
    const template = readFileSync(
      new URL(
        "../../src-tauri/src/prompts/templates/design_partners/company_overview.md",
        import.meta.url
      ),
      "utf8"
    );
    const profile = parseProfile(template);
    expect(profile.product).toStartWith("[Product name] is");
    expect(profile.problem).toStartWith("[Describe the pain");
    expect(profile.stage).toStartWith("We're early");
    expect(profile.goal).toStartWith("Design partners");
    expect(profile.customer).toStartWith("- Roles");
    expect(profile.notFit).toStartWith("- [e.g., enterprises");
    expect(profile.notes).toBe("");
  });

  test("treats an untitled overview as the product description", () => {
    const profile = parseProfile("We sell a SaaS platform for PMs.");
    expect(profile.product).toBe("We sell a SaaS platform for PMs.");
  });

  test("keeps unknown sections, with their headings, in Anything else", () => {
    const profile = parseProfile("## Pricing\n\nFree during beta");
    expect(profile.notes).toBe("## Pricing\n\nFree during beta");
  });
});

describe("serializeProfile", () => {
  test("writes filled fields as headed sections and skips empty ones", () => {
    const profile = { ...emptyProfile(), company: "Mamabird AI", stage: "Private beta" };
    expect(serializeProfile(profile)).toBe(
      "## Company\n\nMamabird AI\n\n## Where we are\n\nPrivate beta\n"
    );
    expect(serializeProfile(emptyProfile())).toBe("");
  });

  test("round-trips without losing anything", () => {
    const original =
      "We sell a SaaS platform.\n\n## Who it's for\n\nPMs\n\n## Pricing\n\nFree during beta\n";
    const once = serializeProfile(parseProfile(original));
    expect(parseProfile(once)).toEqual(parseProfile(original));
    // Stable from then on, so reopening never shows phantom changes
    expect(serializeProfile(parseProfile(once))).toBe(once);
  });
});
