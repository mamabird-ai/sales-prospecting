import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconCircleCheck,
  IconCircleDashed,
  IconCornerDownRight,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUserCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useActivePlaybook } from "@/lib/hooks/use-playbooks";
import {
  SUGGESTED_SECTIONS,
  coverage,
  createSection,
  hasPlaceholder,
  parseSections,
  serializeSections,
  suggestionFor,
  type Section,
} from "@/lib/about-sections";
import { getPromptByType, savePromptByType } from "@/lib/tauri/commands";
import { cn } from "@/lib/utils";

const OVERVIEW_QUERY_KEY = ["prompts", "company_overview"] as const;

/** Every job reads About you; listing them shows why it matters */
const READ_BY = [
  { label: "Find Leads", note: "to search for the right companies", href: "/lead" },
  { label: "Company and person research", note: "to know what to look for", href: "/prompt" },
  { label: "Outreach", note: "to explain who you are", href: "/prompt" },
  { label: "Scoring", note: "to judge fit against what you want", href: "/scoring" },
];

function Header() {
  return (
    <header className="h-10 border-b border-white/5 flex items-center px-4 gap-2">
      <IconUserCircle className="size-4" />
      <h1 className="text-sm font-medium">About you</h1>
    </header>
  );
}

/**
 * The company overview: what you're building and who you're looking for.
 * Every job in the playbook reads it, so it gets its own page.
 */
export default function AboutPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: async () => (await getPromptByType("company_overview"))?.content ?? "",
  });

  if (isLoading || overview === undefined) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center h-64">
          <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      {/* Remount when the saved overview changes, e.g. after switching playbooks */}
      <OverviewEditor key={overview} initial={overview} />
    </>
  );
}

function OverviewEditor({ initial }: { initial: string }) {
  const playbook = useActivePlaybook();
  const [sections, setSections] = useState<Section[]>(() => {
    const parsed = parseSections(initial);
    // A brand-new overview starts with the topics that matter most
    return parsed.length > 0
      ? parsed
      : SUGGESTED_SECTIONS.filter((s) => s.covers).map((s) => createSection(s.title));
  });
  const [saved, setSaved] = useState(initial);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const text = serializeSections(sections);
  // Compare normalized forms so spacing differences don't count as edits
  const dirty = text !== serializeSections(parseSections(saved));
  const topics = useMemo(() => coverage(sections), [sections]);

  const update = (key: string, changes: Partial<Section>) =>
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...changes } : s)));

  const addSection = (title: string) => {
    const section = createSection(title);
    setSections((prev) => [...prev, section]);
    setFocusKey(section.key);
  };

  const goToTopic = (topic: (typeof topics)[number]) => {
    if (topic.section) {
      document.getElementById(`body-${topic.section.key}`)?.focus();
    } else {
      addSection(topic.suggestion.title);
    }
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await savePromptByType("company_overview", text);
      setSaved(text);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prompts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() }),
        // Scores made before this change are now out of date
        queryClient.invalidateQueries({ queryKey: queryKeys.calibration }),
      ]);
      toast.success("Saved");
    } catch (error) {
      toast.error("Couldn't save", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  // ⌘S saves, as in a document editor
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const missingSuggestions = SUGGESTED_SECTIONS.filter(
    (suggestion) => !sections.some((s) => suggestionFor(s.title) === suggestion)
  );

  return (
    <div className="flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="max-w-5xl px-6 pt-6 pb-24 space-y-6">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Describe what you&apos;re building and who you&apos;re looking for
          {playbook ? (
            <>
              {" "}
              in <span className="text-foreground">{playbook.name}</span>
            </>
          ) : null}
          . Claude reads this before every job, so specifics here make every result better.
        </p>

        <div className="grid gap-6 lg:grid-cols-[1fr_15rem]">
          <div className="min-w-0 space-y-3">
            {sections.map((section) => (
              <SectionCard
                key={section.key}
                section={section}
                autoFocus={section.key === focusKey}
                onChange={(changes) => update(section.key, changes)}
                onRemove={() => setSections((prev) => prev.filter((s) => s.key !== section.key))}
              />
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <IconPlus className="size-3.5" />
                  Add a section
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {missingSuggestions.map((suggestion) => (
                  <DropdownMenuItem
                    key={suggestion.title}
                    onSelect={() => addSection(suggestion.title)}
                  >
                    {suggestion.title}
                  </DropdownMenuItem>
                ))}
                {missingSuggestions.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => addSection("")}>
                  <IconPencil />
                  Your own section…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                A strong description covers
              </h3>
              <ul className="space-y-1">
                {topics.map((topic) => (
                  <li key={topic.suggestion.title}>
                    <button
                      type="button"
                      onClick={() => goToTopic(topic)}
                      className="flex w-full items-start gap-2 rounded px-1 py-1 -mx-1 text-left text-xs transition-colors hover:bg-white/[0.04]"
                    >
                      {topic.status === "written" ? (
                        <IconCircleCheck className="mt-px size-3.5 shrink-0 text-green-500" />
                      ) : (
                        <IconCircleDashed
                          className={cn(
                            "mt-px size-3.5 shrink-0",
                            topic.status === "needs-details"
                              ? "text-yellow-500"
                              : "text-muted-foreground/50"
                          )}
                        />
                      )}
                      <span>
                        <span
                          className={
                            topic.status === "written" ? "text-muted-foreground" : "text-foreground"
                          }
                        >
                          {topic.suggestion.covers}
                        </span>
                        {topic.status !== "written" && (
                          <span className="block text-[11px] text-muted-foreground">
                            {topic.status === "missing" ? "Add this" : "Fill in your details"}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Read by every job
              </h3>
              <ul className="space-y-2">
                {READ_BY.map((item) => (
                  <li key={item.label} className="flex gap-2 text-xs">
                    <IconCornerDownRight
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40"
                    />
                    <span>
                      <Link
                        to={item.href}
                        className="text-foreground hover:underline underline-offset-2"
                      >
                        {item.label}
                      </Link>
                      <span className="block text-muted-foreground">{item.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Appears only when there's something to save */}
      <div
        className={cn(
          "sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        )}
        aria-hidden={!dirty}
      >
        <div className="max-w-5xl px-6 py-3 flex items-center gap-3">
          <span className="flex-1 text-xs text-muted-foreground">You have unsaved changes.</span>
          <Button
            variant="ghost"
            onClick={() => setSections(parseSections(saved))}
            disabled={saving}
            tabIndex={dirty ? 0 : -1}
          >
            Discard
          </Button>
          <Button onClick={save} disabled={saving} tabIndex={dirty ? 0 : -1}>
            {saving && <IconLoader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Text that reads like content and turns into a field on hover or focus */
const inlineField =
  "w-full rounded bg-transparent px-1.5 -mx-1.5 outline-none transition-colors border border-transparent hover:border-white/10 focus:border-white/20 focus:bg-white/[0.03] placeholder:text-muted-foreground/50";

function SectionCard({
  section,
  autoFocus,
  onChange,
  onRemove,
}: {
  section: Section;
  autoFocus: boolean;
  onChange: (changes: Partial<Section>) => void;
  onRemove: () => void;
}) {
  const suggestion = suggestionFor(section.title);
  const needsDetails = hasPlaceholder(section.body);
  const name = section.title.trim() || "this section";

  return (
    <div
      className={cn(
        "group rounded-lg border bg-white/[0.02] px-4 py-3 transition-colors",
        needsDetails ? "border-yellow-500/25" : "border-white/[0.07]"
      )}
    >
      <div className="flex items-start gap-2">
        <input
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Section name"
          aria-label="Section name"
          autoFocus={autoFocus && !section.title}
          className={cn(inlineField, "py-0.5 text-sm font-medium text-foreground")}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="text-muted-foreground/40 hover:text-red-400 group-hover:text-muted-foreground"
        >
          <IconTrash />
        </Button>
      </div>
      <AutoGrowTextarea
        id={`body-${section.key}`}
        value={section.body}
        onChange={(body) => onChange({ body })}
        autoFocus={autoFocus && !!section.title}
        placeholder={suggestion?.placeholder ?? "What should Claude know?"}
        aria-label={`${name} text`}
        className={cn(inlineField, "mt-1 py-1 text-[13px]/relaxed text-muted-foreground")}
      />
      {needsDetails && (
        <p className="mt-2 text-[11px] text-yellow-500/90">
          Fill in the [bracketed] parts with your details.
        </p>
      )}
    </div>
  );
}
