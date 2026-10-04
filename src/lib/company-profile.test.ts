import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  emptyProfile,
  formatForAssistant,
  formatForCopy,
  looksLikeProfile,
  parseProfile,
  readPasted,
  readProfile,
  serializeProfile,
} from "./company-profile";

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

describe("copy and paste", () => {
  const filled = {
    ...emptyProfile(),
    company: "Mamabird AI",
    website: "mamabird.ai",
    product: "A private feedback community for product teams.",
    stage: "Private beta",
    customer: "- PMs at B2B SaaS\n- Product ops leads",
  };

  test("copied text pastes back to the same profile", () => {
    expect(parseProfile(formatForCopy(filled))).toEqual(filled);
  });

  test("copied text lists every question, empty ones included", () => {
    const text = formatForCopy(emptyProfile());
    expect(text).toContain("## What problem does it solve?");
    expect(text).toContain("## Who isn't a fit?");
  });

  test("the assistant version contains the profile and asks for it back", () => {
    const text = formatForAssistant(filled);
    expect(text).toContain(formatForCopy(filled));
    expect(text).toContain("Reply with only the updated profile");
  });

  test("reads bold labels, as chat assistants often reply", () => {
    const { profile, found } = readProfile(
      "**Company name**\nMamabird AI\n\n**What problem does it solve?**\nFeedback gets lost.\n"
    );
    expect(found).toEqual(["company", "problem"]);
    expect(profile.problem).toBe("Feedback gets lost.");
  });

  test("reads one-line labels with values", () => {
    const { profile } = readProfile(
      "Company name: Mamabird AI\nWebsite: https://mamabird.ai\n**Stage:** Private beta"
    );
    expect(profile.company).toBe("Mamabird AI");
    expect(profile.website).toBe("https://mamabird.ai");
    expect(profile.stage).toBe("Private beta");
  });

  test("reads headings with different wording or levels", () => {
    const { profile } = readProfile(
      "# Ideal customer profile\n\nPMs\n\n### Not a fit:\n\nAgencies"
    );
    expect(profile.customer).toBe("PMs");
    expect(profile.notFit).toBe("Agencies");
  });

  test("leaves list items with colons inside their section", () => {
    const { profile } = readProfile("## Who's a great fit?\n\n- Roles: PMs\n- Size: 10-300 people");
    expect(profile.customer).toBe("- Roles: PMs\n- Size: 10-300 people");
  });

  test("tells a whole profile apart from ordinary text", () => {
    expect(looksLikeProfile(formatForCopy(filled))).toBe(true);
    expect(looksLikeProfile("Just a sentence about our product.")).toBe(false);
  });
});

describe("readPasted", () => {
  test("drops the chat around an assistant's reply", () => {
    const { profile } = readPasted(
      "Here's your updated profile:\n\n## What do you make?\n\nA feedback community.\n\n## Who's a great fit?\n\nPMs.\n\nLet me know if you'd like any changes!"
    );
    expect(profile.product).toBe("A feedback community.");
    expect(profile.customer).toBe("PMs.");
    expect(profile.notes).toBe("");
  });

  test("ignores our own request if it's pasted back by mistake", () => {
    const filled = { ...emptyProfile(), product: "A feedback community.", stage: "Private beta" };
    const { profile } = readPasted(`${formatForAssistant(filled)}Make it punchier.`);
    expect(profile).toEqual(filled);
  });

  test("keeps a plain paragraph as the product description", () => {
    expect(readPasted("We help PMs run feedback communities.").profile.product).toBe(
      "We help PMs run feedback communities."
    );
  });
});
