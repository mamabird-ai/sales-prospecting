/**
 * The About you text is Markdown. Each "## Heading" becomes its own section in
 * the editor, and sections are joined back into Markdown on save.
 */

export interface Section {
  key: string;
  title: string;
  body: string;
}

export interface SuggestedSection {
  title: string;
  placeholder: string;
  /** What this section covers, for the "a strong description covers" list */
  covers?: string;
}

export const SUGGESTED_SECTIONS: SuggestedSection[] = [
  {
    title: "What we're building",
    placeholder: "What your product does and who it's for, in a sentence or two.",
    covers: "What you're building",
  },
  {
    title: "The problem it solves",
    placeholder: "The pain in your users' own words, and how they handle it today.",
    covers: "The problem it solves",
  },
  {
    title: "Where we are",
    placeholder: "Your stage, and whether you're selling or asking for feedback.",
  },
  {
    title: "What we're looking for",
    placeholder: "The kind of company or person you want, and what you'll ask of them.",
  },
  {
    title: "Who is a great fit",
    placeholder: "Roles, company size, and signs they have the problem.",
    covers: "Who's a great fit",
  },
  {
    title: "Who is not a fit",
    placeholder: "Who to skip, so research doesn't waste time on them.",
    covers: "Who isn't a fit",
  },
];

const HEADING = /^##\s+(.+?)\s*$/;
const PLACEHOLDER = /\[[^\]\n]+\]/;

let nextKey = 0;
const newKey = () => `section-${nextKey++}`;

export function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { key: newKey(), title: "", body: "" };
  const lines: string[] = [];

  const flush = () => {
    current.body = lines.join("\n").trim();
    if (current.title || current.body) sections.push(current);
    lines.length = 0;
  };

  for (const line of text.split("\n")) {
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      current = { key: newKey(), title: heading[1], body: "" };
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

export function serializeSections(sections: Section[]): string {
  const blocks = sections
    .map((section, index) => {
      const body = section.body.trim();
      let title = section.title.trim();
      // Untitled text after another section would merge into it when read back
      if (!title && index > 0 && body) title = "Notes";
      if (!title) return body;
      return body ? `## ${title}\n\n${body}` : `## ${title}`;
    })
    .filter(Boolean);
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

export const createSection = (title = ""): Section => ({ key: newKey(), title, body: "" });

export const hasPlaceholder = (text: string) => PLACEHOLDER.test(text);

const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "'").trim();

export function suggestionFor(title: string): SuggestedSection | undefined {
  return SUGGESTED_SECTIONS.find((suggestion) => normalize(suggestion.title) === normalize(title));
}

export type Coverage = "written" | "needs-details" | "missing";

/** How well each essential topic is covered, in the order they're suggested */
export function coverage(sections: Section[]) {
  // An untitled opening paragraph is almost always the product description
  const intro = sections[0] && !sections[0].title.trim() ? sections[0] : undefined;

  return SUGGESTED_SECTIONS.filter((suggestion) => suggestion.covers).map((suggestion, index) => {
    const section =
      sections.find((s) => normalize(s.title) === normalize(suggestion.title)) ??
      (index === 0 ? intro : undefined);
    const status: Coverage =
      !section || !section.body.trim()
        ? "missing"
        : hasPlaceholder(section.body)
          ? "needs-details"
          : "written";
    return { suggestion, section, status };
  });
}
