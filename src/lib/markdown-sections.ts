/**
 * Split the company overview Markdown into "## Heading" sections, which the
 * Your company form maps onto its fields.
 */

export interface Section {
  key: string;
  title: string;
  body: string;
}

const HEADING = /^##\s+(.+?)\s*$/;

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
