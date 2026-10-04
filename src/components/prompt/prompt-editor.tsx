import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  IconArrowRight,
  IconBuilding,
  IconCornerDownRight,
  IconLoader2,
  IconMessageCircle,
  IconUser,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { queryClient } from "@/lib/query/query-client";
import { savePromptByType } from "@/lib/tauri/commands";
import type { PromptType } from "@/lib/tauri/types";
import type { PromptContents } from "@/pages/prompt";
import { cn } from "@/lib/utils";

interface PromptEditorProps {
  prompts: PromptContents;
}

/** The company overview has its own page (About you), so it isn't a step here */
type StepId = Exclude<PromptType, "company_overview">;

interface FlowItem {
  label: string;
  /** Explains where this goes or comes from */
  note?: string;
  /** Another step this connects to, shown as a link */
  step?: StepId;
  /** A page this connects to */
  href?: string;
}

interface Step {
  id: StepId;
  number: number;
  title: string;
  icon: typeof IconBuilding;
  trigger: string;
  placeholder: string;
  receives: FlowItem[];
  produces: FlowItem[];
}

const ABOUT_YOU: FlowItem = {
  label: "About you",
  note: "what you're building and who you're looking for",
  href: "/about",
};

// Mirrors what the prompt builders in src-tauri/src/commands/research.rs send and expect back
const STEPS: Step[] = [
  {
    id: "company",
    number: 1,
    title: "Company research",
    icon: IconBuilding,
    trigger: "Runs when you click Research on a company",
    placeholder:
      "What should Claude find out about each company? For example: what they do, signs they have the problem you solve, and who to talk to.",
    receives: [ABOUT_YOU, { label: "The company's name, website, industry, location, and size" }],
    produces: [
      {
        label: "Company profile",
        note: "read by Outreach and when scoring",
        step: "conversation_topics",
      },
      {
        label: "People who work there",
        note: "added to People, ready for Person research",
        step: "person",
      },
      { label: "Missing details such as industry, size, and LinkedIn" },
    ],
  },
  {
    id: "person",
    number: 2,
    title: "Person research",
    icon: IconUser,
    trigger: "Runs when you click Research on a person",
    placeholder:
      "What should Claude find out about each person? For example: their role, whether they have the problem, and how they like to be contacted.",
    receives: [
      ABOUT_YOU,
      { label: "The person's name, title, email, and LinkedIn" },
      { label: "Their company's name and website" },
    ],
    produces: [
      { label: "Person profile", note: "read by Outreach", step: "conversation_topics" },
      { label: "Missing details such as title, email, and LinkedIn" },
    ],
  },
  {
    id: "conversation_topics",
    number: 3,
    title: "Outreach",
    icon: IconMessageCircle,
    trigger: "Runs when you click Generate topics on a person",
    placeholder:
      "What should Claude write for reaching out? For example: why this person, a short first message, a follow-up, and questions for the call.",
    receives: [
      ABOUT_YOU,
      { label: "The person's details and profile", note: "from Person research", step: "person" },
      {
        label: "Their company's details and profile",
        note: "from Company research",
        step: "company",
      },
    ],
    produces: [{ label: "Talking points and messages, shown on the person's page" }],
  },
];

const STEP_IDS = STEPS.map((step) => step.id);

export function PromptEditor({ prompts }: PromptEditorProps) {
  const [activeId, setActiveId] = useState<StepId>("company");
  const [contents, setContents] = useState(() => prompts);
  // Last saved version, which Discard returns to
  const [saved, setSaved] = useState(() => prompts);
  const [saving, setSaving] = useState(false);

  const dirtySteps = STEPS.filter((step) => contents[step.id] !== saved[step.id]);
  const dirty = dirtySteps.length > 0;
  const active = STEPS.find((step) => step.id === activeId)!;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      for (const step of dirtySteps) {
        await savePromptByType(step.id, contents[step.id]);
      }
      setSaved(contents);
      // Matches what's saved, so refetching won't reset this editor
      void queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast.success("Instructions saved");
    } catch (error) {
      toast.error("Couldn't save instructions", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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

  // Arrow keys move between steps, as in any tab list
  const onStepKeyDown = (e: React.KeyboardEvent) => {
    const index = STEP_IDS.indexOf(activeId);
    const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : null;
    if (next === null || next < 0 || next >= STEP_IDS.length) return;
    e.preventDefault();
    setActiveId(STEP_IDS[next]);
    document.getElementById(`step-tab-${STEP_IDS[next]}`)?.focus();
  };

  return (
    <div className="flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="max-w-5xl px-6 pt-6 pb-24 space-y-6">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Three research jobs run in this order, and each builds on what the one before found. Tell
          Claude what to look for at each step. Every step also reads{" "}
          <Link to="/about" className="text-foreground underline underline-offset-2">
            About you
          </Link>
          .
        </p>

        <div
          role="tablist"
          aria-label="Research steps"
          onKeyDown={onStepKeyDown}
          className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
        >
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const selected = step.id === activeId;
            const unsaved = contents[step.id] !== saved[step.id];
            return (
              <div key={step.id} className="contents">
                {index > 0 && (
                  <IconArrowRight
                    aria-hidden
                    className="hidden size-4 shrink-0 text-muted-foreground/40 sm:block"
                  />
                )}
                <button
                  id={`step-tab-${step.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="step-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(step.id)}
                  className={cn(
                    "flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected
                      ? "border-white/20 bg-white/[0.05]"
                      : "border-white/[0.07] hover:border-white/15 hover:bg-white/[0.02]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                      selected
                        ? "border-primary text-primary"
                        : "border-white/15 text-muted-foreground"
                    )}
                  >
                    {step.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      {step.title}
                      {unsaved && (
                        <span
                          className="size-1.5 rounded-full bg-primary"
                          aria-label="Unsaved changes"
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {step.trigger}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div
          id="step-panel"
          role="tabpanel"
          aria-labelledby={`step-tab-${active.id}`}
          className="grid gap-6 lg:grid-cols-[1fr_15rem]"
        >
          <div className="min-w-0 space-y-2">
            <label htmlFor="step-instructions" className="block text-sm font-medium">
              Your instructions for {active.title.toLowerCase()}
            </label>
            <p className="text-xs text-muted-foreground">
              Write it like a brief for a researcher. Headings and lists help Claude organize its
              answer.
            </p>
            <AutoGrowTextarea
              id="step-instructions"
              value={contents[active.id]}
              onChange={(value) => setContents((prev) => ({ ...prev, [active.id]: value }))}
              placeholder={active.placeholder}
              className="min-h-64 w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px]/relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-white/15 focus:border-white/25"
            />
          </div>

          <aside
            aria-label={`How ${active.title.toLowerCase()} connects`}
            className="space-y-5 lg:sticky lg:top-6 lg:self-start"
          >
            <FlowList title="Claude also gets" items={active.receives} onStep={setActiveId} />
            <FlowList title="It produces" items={active.produces} onStep={setActiveId} />
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
          <span className="flex-1 text-xs text-muted-foreground">
            Unsaved changes in {dirtySteps.map((step) => step.title).join(" and ")}
          </span>
          <Button
            variant="ghost"
            onClick={() => setContents(saved)}
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

function FlowList({
  title,
  items,
  onStep,
}: {
  title: string;
  items: FlowItem[];
  onStep: (step: StepId) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => {
          const target = item.step ? STEPS.find((step) => step.id === item.step) : undefined;
          return (
            <li key={item.label} className="flex gap-2 text-xs">
              <IconCornerDownRight
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40"
              />
              <span className="min-w-0">
                {item.href ? (
                  <Link to={item.href} className="text-foreground underline underline-offset-2">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{item.label}</span>
                )}
                {item.note && (
                  <span className="block text-muted-foreground">
                    {target ? (
                      <button
                        type="button"
                        onClick={() => onStep(target.id)}
                        className="text-left underline decoration-white/20 underline-offset-2 hover:text-foreground hover:decoration-white/50"
                      >
                        {item.note}
                      </button>
                    ) : (
                      item.note
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
