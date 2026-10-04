/**
 * The "Your company" form. Each field is saved as a "## Heading" section of
 * the company overview Markdown that every job reads, so jobs need no change.
 */

import { parseSections } from "./markdown-sections";

export type FieldKey =
  | "company"
  | "website"
  | "product"
  | "problem"
  | "stage"
  | "goal"
  | "customer"
  | "notFit"
  | "notes";

export type CompanyProfile = Record<FieldKey, string>;

interface FieldSpec {
  heading: string;
  /** Other headings that mean the same thing, from older overviews */
  aliases?: string[];
}

/** Save order, which is also the order the form shows them in */
const FIELDS: Record<FieldKey, FieldSpec> = {
  company: { heading: "Company" },
  website: { heading: "Website" },
  product: { heading: "What we're building", aliases: ["What we sell", "What we do", "Product"] },
  problem: { heading: "The problem it solves", aliases: ["Problem"] },
  stage: { heading: "Where we are", aliases: ["Stage"] },
  goal: { heading: "What we're looking for", aliases: ["Goal"] },
  customer: {
    heading: "Who is a great fit",
    aliases: ["Who it's for", "Ideal customer", "Target customer"],
  },
  notFit: { heading: "Who is not a fit" },
  notes: { heading: "Anything else", aliases: ["Notes"] },
};

const KEYS = Object.keys(FIELDS) as FieldKey[];

export const emptyProfile = (): CompanyProfile =>
  Object.fromEntries(KEYS.map((key) => [key, ""])) as CompanyProfile;

const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "'").trim();

function fieldForHeading(heading: string): FieldKey | undefined {
  const target = normalize(heading);
  return KEYS.find((key) =>
    [FIELDS[key].heading, ...(FIELDS[key].aliases ?? [])].some((h) => normalize(h) === target)
  );
}

const append = (current: string, text: string) => (current ? `${current}\n\n${text}` : text);

export function parseProfile(text: string): CompanyProfile {
  const profile = emptyProfile();
  for (const section of parseSections(text)) {
    const key = section.title ? fieldForHeading(section.title) : undefined;
    if (key) {
      profile[key] = append(profile[key], section.body);
    } else if (!section.title) {
      // An untitled paragraph is almost always the product description
      if (profile.product) profile.notes = append(profile.notes, section.body);
      else profile.product = section.body;
    } else {
      // Keep sections the form doesn't know, with their heading, in Anything else
      profile.notes = append(profile.notes, `## ${section.title}\n\n${section.body}`.trim());
    }
  }
  return profile;
}

export function serializeProfile(profile: CompanyProfile): string {
  const blocks = KEYS.flatMap((key) => {
    const value = profile[key].trim();
    if (!value) return [];
    // Notes that already carry their own headings are written as they are
    if (key === "notes" && value.startsWith("## ")) return [value];
    return [`## ${FIELDS[key].heading}\n\n${value}`];
  });
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

/** True when a field still holds template text like "[Product name]" */
export const hasPlaceholder = (text: string) => /\[[^\]\n]+\]/.test(text);
