/**
 * The "Your company" form. Each field is saved as a "## Heading" section of
 * the company overview Markdown that every job reads, so jobs need no change.
 *
 * The same parser reads text pasted back from an AI assistant, so it accepts
 * the shapes those replies take: "## Heading", "**Heading**", "Heading:" on
 * its own line, "Label: value" on one line, or a plain paragraph.
 */

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
  /** Heading used when saving, which jobs read */
  heading: string;
  /** The question shown in the form, and the heading used when copying */
  label: string;
  /** Other headings that mean the same thing */
  aliases?: string[];
}

/** Save order, which is also the order the form shows them in */
export const FIELDS: Record<FieldKey, FieldSpec> = {
  company: { heading: "Company", label: "Company name", aliases: ["Name"] },
  website: { heading: "Website", label: "Website", aliases: ["URL", "Site"] },
  product: {
    heading: "What we're building",
    label: "What do you make?",
    aliases: ["What we sell", "What we do", "What we make", "Product", "Overview", "Description"],
  },
  problem: {
    heading: "The problem it solves",
    label: "What problem does it solve?",
    aliases: ["Problem", "The problem", "Problem it solves", "Pain points"],
  },
  stage: { heading: "Where we are", label: "What stage are you at?", aliases: ["Stage"] },
  goal: {
    heading: "What we're looking for",
    label: "What do you want from this playbook?",
    aliases: ["Goal", "What we want", "Looking for"],
  },
  customer: {
    heading: "Who is a great fit",
    label: "Who's a great fit?",
    aliases: [
      "Who it's for",
      "Ideal customer",
      "Target customer",
      "Great fit",
      "Ideal customer profile",
      "ICP",
    ],
  },
  notFit: {
    heading: "Who is not a fit",
    label: "Who isn't a fit?",
    aliases: ["Not a fit", "Who to avoid", "Bad fit"],
  },
  notes: {
    heading: "Anything else",
    label: "Anything else Claude should know?",
    aliases: ["Notes", "Other", "Additional context"],
  },
};

export const FIELD_KEYS = Object.keys(FIELDS) as FieldKey[];

export const emptyProfile = (): CompanyProfile =>
  Object.fromEntries(FIELD_KEYS.map((key) => [key, ""])) as CompanyProfile;

/** Lowercase, straight quotes, and no punctuation, so "Who's a great fit?" matches "whos a great fit" */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();

const LOOKUP = new Map<string, FieldKey>(
  FIELD_KEYS.flatMap((key) =>
    [FIELDS[key].heading, FIELDS[key].label, ...(FIELDS[key].aliases ?? [])].map(
      (name) => [normalize(name), key] as const
    )
  )
);

const fieldFor = (name: string) => LOOKUP.get(normalize(name));

type Line =
  | { kind: "field"; key: FieldKey; rest: string }
  | { kind: "heading"; title: string }
  | { kind: "text"; text: string };

/** Classify one line: a known field heading, some other Markdown heading, or text */
function classify(raw: string): Line {
  const line = raw.trim();
  const markdownHeading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
  const bold = line.match(/^(?:\*\*|__)(.+?)(?:\*\*|__):?$/);
  const candidate = (markdownHeading?.[1] ?? bold?.[1] ?? line).replace(/:$/, "").trim();

  const key = fieldFor(candidate);
  if (key && (markdownHeading || bold || line.endsWith(":") || line.length < 60)) {
    return { kind: "field", key, rest: "" };
  }

  // "Company name: Mamabird AI" or "**Stage:** Private beta"
  const inline = line.match(/^(?:\*\*|__)?([^:*_]{2,60}?)(?:\*\*|__)?:\s*(?:\*\*|__)?\s*(.+)$/);
  const inlineKey = inline && fieldFor(inline[1]);
  if (inline && inlineKey) {
    return { kind: "field", key: inlineKey, rest: inline[2].trim() };
  }

  if (markdownHeading) return { kind: "heading", title: markdownHeading[1] };
  return { kind: "text", text: raw };
}

const append = (current: string, text: string) => (current ? `${current}\n\n${text}` : text);

/**
 * Read a profile from saved or pasted text. Returns the fields that were
 * found, so a paste can say what it will fill in.
 */
export function readProfile(text: string): { profile: CompanyProfile; found: FieldKey[] } {
  const profile = emptyProfile();
  type Block = { key?: FieldKey; title?: string; lines: string[] };
  const blocks: Block[] = [];
  let current: Block = { lines: [] };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = classify(raw);
    if (line.kind === "field") {
      blocks.push(current);
      current = { key: line.key, lines: line.rest ? [line.rest] : [] };
    } else if (line.kind === "heading") {
      blocks.push(current);
      current = { title: line.title, lines: [] };
    } else {
      current.lines.push(line.text);
    }
  }
  blocks.push(current);

  for (const block of blocks) {
    const body = block.lines.join("\n").trim();
    if (block.key) {
      if (body) profile[block.key] = append(profile[block.key], body);
    } else if (block.title) {
      // Keep sections the form doesn't know, with their heading, in Anything else
      profile.notes = append(profile.notes, `## ${block.title}\n\n${body}`.trim());
    } else if (body) {
      // Untitled text is almost always the product description
      if (profile.product) profile.notes = append(profile.notes, body);
      else profile.product = body;
    }
  }

  return { profile, found: FIELD_KEYS.filter((key) => profile[key].trim() !== "") };
}

export const parseProfile = (text: string) => readProfile(text).profile;

const ASSISTANT_INTRO = "Below is my company profile from a lead research tool.";
const ASSISTANT_OUTRO = "What I want to change or add:";
const CHATTER =
  /^(let me know|feel free|i hope|hope this|would you like|happy to|here'?s|here is)/i;

/**
 * Read text pasted from an AI assistant. Drops our own request wrapper if it
 * was pasted back, and the chat around a reply ("Here's your updated
 * profile:", "Let me know if…") so it doesn't end up in a field.
 */
export function readPasted(text: string): ReturnType<typeof readProfile> {
  let body = text.replace(/\r\n/g, "\n");
  if (body.includes(ASSISTANT_INTRO)) {
    const start = body.search(/^#{1,6}\s/m);
    if (start >= 0) body = body.slice(start);
  }
  const outro = body.indexOf(ASSISTANT_OUTRO);
  if (outro >= 0) body = body.slice(0, outro);

  const paragraphs = body.trim().split(/\n\s*\n/);
  const isChatter = (paragraph: string | undefined) =>
    !!paragraph &&
    paragraph.length < 200 &&
    !paragraph.includes("\n") &&
    CHATTER.test(paragraph.trim());
  if (isChatter(paragraphs[0]) && readProfile(paragraphs.slice(1).join("\n\n")).found.length > 0) {
    paragraphs.shift();
  }
  if (paragraphs.length > 1 && isChatter(paragraphs[paragraphs.length - 1])) paragraphs.pop();

  return readProfile(paragraphs.join("\n\n"));
}

/** True when pasted text holds several sections, i.e. a whole profile */
export function looksLikeProfile(text: string): boolean {
  return readPasted(text).found.length >= 2;
}

/** The saved form: headed Markdown that every job reads */
export function serializeProfile(profile: CompanyProfile): string {
  const blocks = FIELD_KEYS.flatMap((key) => {
    const value = profile[key].trim();
    if (!value) return [];
    // Notes that already carry their own headings are written as they are
    if (key === "notes" && value.startsWith("## ")) return [value];
    return [`## ${FIELDS[key].heading}\n\n${value}`];
  });
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

/**
 * Text for copying out: every question as a heading, empty ones included, so
 * an AI assistant can see what's missing and fill it in
 */
export function formatForCopy(profile: CompanyProfile): string {
  return `${FIELD_KEYS.map((key) => `## ${FIELDS[key].label}\n\n${profile[key].trim()}`).join("\n\n")}\n`;
}

/** The profile wrapped in a request an AI assistant can act on directly */
export function formatForAssistant(profile: CompanyProfile): string {
  return `Below is my company profile from a lead research tool. Help me improve it using what I tell you about my business at the end.

- Keep every heading exactly as written, including the empty ones
- Fill in anything that's empty if what I tell you covers it
- Be specific and concrete; avoid marketing language
- Reply with only the updated profile, so I can paste it back into the tool

${formatForCopy(profile)}
What I want to change or add:
`;
}

/** True when a field still holds template text like "[Product name]" */
export const hasPlaceholder = (text: string) => /\[[^\]\n]+\]/.test(text);
