import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconBuildingStore, IconLoader2, IconSparkles, IconWorld } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useActivePlaybook } from "@/lib/hooks/use-playbooks";
import {
  hasPlaceholder,
  parseProfile,
  serializeProfile,
  type CompanyProfile,
  type FieldKey,
} from "@/lib/company-profile";
import { draftCompanyProfile, getPromptByType, savePromptByType } from "@/lib/tauri/commands";
import { cn } from "@/lib/utils";

const OVERVIEW_QUERY_KEY = ["prompts", "company_overview"] as const;

const STAGES = ["Idea", "Prototype", "Private beta", "Launched", "Growing"];
const GOALS = [
  "Customers to sell to",
  "Design partners who'll try the product and give feedback",
  "Partners or integrations",
];

function Header() {
  return (
    <header className="h-10 border-b border-white/5 flex items-center px-4 gap-2">
      <IconBuildingStore className="size-4" />
      <h1 className="text-sm font-medium">Your company</h1>
    </header>
  );
}

/**
 * What the company does and who it's looking for. Every job in the playbook
 * reads it. Claude can draft it from the company's website.
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
      <CompanyForm key={overview} initial={overview} />
    </>
  );
}

function CompanyForm({ initial }: { initial: string }) {
  const playbook = useActivePlaybook();
  const [profile, setProfile] = useState(() => parseProfile(initial));
  const [saved, setSaved] = useState(initial);
  // Fields Claude filled in that the user hasn't touched since
  const [drafted, setDrafted] = useState<Set<FieldKey>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compare normalized forms so formatting differences don't count as edits
  const dirty = serializeProfile(profile) !== serializeProfile(parseProfile(saved));

  const set = (key: FieldKey, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setDrafted((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const draft = async () => {
    setDrafting(true);
    try {
      const result = await draftCompanyProfile(profile.website);
      const filled: Partial<CompanyProfile> = {
        company: result.companyName ?? undefined,
        product: result.product ?? undefined,
        problem: result.problem ?? undefined,
        customer: result.customer ?? undefined,
        notFit: result.notAFit ?? undefined,
        stage: result.stage ?? undefined,
      };
      // Only fill what's empty or still template text; never overwrite the user's words
      const keys = (Object.keys(filled) as FieldKey[]).filter(
        (key) => filled[key] && (!profile[key].trim() || hasPlaceholder(profile[key]))
      );
      setProfile((prev) => ({
        ...prev,
        ...Object.fromEntries(keys.map((key) => [key, filled[key]])),
      }));
      setDrafted(new Set(keys));
      if (keys.length > 0) {
        toast.success(`Filled in ${keys.length} ${keys.length === 1 ? "field" : "fields"}`, {
          description: "Check the ones marked Drafted, then save.",
        });
      } else {
        toast.info("Nothing to fill in", {
          description: "Every field already has your own text.",
        });
      }
    } catch (error) {
      toast.error("Couldn't draft from the website", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const text = serializeProfile(profile);
      await savePromptByType("company_overview", text);
      setSaved(text);
      setDrafted(new Set());
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

  // ⌘S saves, as in other editors
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

  const field = (key: FieldKey) => ({
    value: profile[key],
    onChange: (value: string) => set(key, value),
    drafted: drafted.has(key),
  });

  return (
    <div className="flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="max-w-2xl px-6 pt-8 pb-28">
        <h2 className="text-lg font-medium">Tell Claude about your company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude reads this before every search, research, message, and score
          {playbook ? ` in ${playbook.name}` : ""}. Fill it in once, or let Claude draft it from
          your website.
        </p>

        <div className="mt-6 rounded-lg border border-primary/25 bg-primary/[0.04] p-4">
          <label htmlFor="website" className="text-sm font-medium">
            Your website
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <IconWorld className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="website"
                value={profile.website}
                onChange={(e) => set("website", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && profile.website.trim() && !drafting) void draft();
                }}
                placeholder="acme.com"
                autoComplete="url"
                className="h-9 pl-8 text-sm md:text-sm"
              />
            </div>
            <Button onClick={draft} disabled={drafting || !profile.website.trim()} className="h-9">
              {drafting ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconSparkles className="size-4" />
              )}
              {drafting ? "Reading your site…" : "Draft for me"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {drafting
              ? "Usually takes under a minute. You can keep editing meanwhile."
              : "Claude reads your site and fills in the empty fields below. You review before saving."}
          </p>
        </div>

        <FormSection title="Your company">
          <TextField
            label="Company name"
            {...field("company")}
            single
            autoComplete="organization"
          />
          <TextField
            label="What do you make?"
            help="One or two sentences, the way you'd explain it to a customer."
            {...field("product")}
          />
          <TextField
            label="What problem does it solve?"
            help="The pain in your customers' words, and how they handle it today."
            {...field("problem")}
          />
          <ChoiceField
            label="What stage are you at?"
            choices={STAGES}
            withOther
            {...field("stage")}
          />
        </FormSection>

        <FormSection title="Who you're looking for">
          <ChoiceField
            label="What do you want from this playbook?"
            help="Pick one, then add details if you like."
            choices={GOALS}
            {...field("goal")}
          />
          <TextField
            label="Who's a great fit?"
            help="Roles, company size, and signs they need what you make."
            {...field("customer")}
          />
          <TextField
            label="Who isn't a fit?"
            optional
            help="Who to skip, so research doesn't spend time on them."
            {...field("notFit")}
          />
        </FormSection>

        <FormSection title="Anything else">
          <TextField
            label="Anything else Claude should know?"
            optional
            help="Pricing, competitors, words to avoid, anything that helps."
            {...field("notes")}
          />
        </FormSection>
      </div>

      {/* Appears only when there's something to save */}
      <div
        className={cn(
          "sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        )}
        aria-hidden={!dirty}
      >
        <div className="max-w-2xl px-6 py-3 flex items-center gap-3">
          <span className="flex-1 text-xs text-muted-foreground">
            {drafted.size > 0
              ? "Review the drafted fields, then save."
              : "You have unsaved changes."}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              setProfile(parseProfile(saved));
              setDrafted(new Set());
            }}
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="border-b border-white/10 pb-2 text-sm font-medium">{title}</h3>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  help?: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  drafted: boolean;
}

function FieldLabel({
  id,
  label,
  optional,
  drafted,
}: {
  id: string;
  label: string;
  optional?: boolean;
  drafted: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
      {label}
      {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      {drafted && (
        <span
          className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          title="Filled in from your website. Check it, then save."
        >
          <IconSparkles className="size-3" />
          Drafted
        </span>
      )}
    </label>
  );
}

function PlaceholderHint({ value }: { value: string }) {
  if (!hasPlaceholder(value)) return null;
  return (
    <p className="mt-1.5 text-xs text-yellow-500/90">
      Replace the [bracketed] text with your details.
    </p>
  );
}

const controlClass =
  "w-full rounded-md border border-input bg-white/[0.03] px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-white/20 focus:border-ring focus:ring-1 focus:ring-ring";

function TextField({
  label,
  help,
  optional,
  value,
  onChange,
  drafted,
  single,
  autoComplete,
}: FieldProps & { single?: boolean; autoComplete?: string }) {
  const id = useId();
  return (
    <div>
      <FieldLabel id={id} label={label} optional={optional} drafted={drafted} />
      {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      <div className="mt-2">
        {single ? (
          <Input
            id={id}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            className={cn(controlClass, "h-9 py-0 md:text-sm", drafted && "border-primary/40")}
          />
        ) : (
          <AutoGrowTextarea
            id={id}
            value={value}
            onChange={onChange}
            className={cn(
              controlClass,
              "min-h-[4.5rem] leading-relaxed",
              drafted && "border-primary/40"
            )}
          />
        )}
      </div>
      <PlaceholderHint value={value} />
    </div>
  );
}

/**
 * One-click choices that fill the field. With `withOther`, a text box appears
 * only for answers the choices don't cover; otherwise it's always there for
 * details.
 */
function ChoiceField({
  label,
  help,
  choices,
  withOther,
  value,
  onChange,
  drafted,
}: FieldProps & { choices: string[]; withOther?: boolean }) {
  const id = useId();
  const selected = choices.find((choice) => value.trim().toLowerCase() === choice.toLowerCase());
  const custom = !selected && value.trim() !== "";
  const [otherOpen, setOtherOpen] = useState(custom);
  // A picked choice needs no text box; Other or a custom answer does
  const showText = !withOther || (!selected && (otherOpen || custom));

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground"
    );

  return (
    <div>
      <FieldLabel id={id} label={label} drafted={drafted} />
      {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected === choice}
            onClick={() => {
              onChange(choice);
              setOtherOpen(false);
            }}
            className={chip(selected === choice)}
          >
            {choice}
          </button>
        ))}
        {withOther && (
          <button
            type="button"
            role="radio"
            aria-checked={!selected && (otherOpen || custom)}
            onClick={() => {
              if (selected) onChange("");
              setOtherOpen(true);
              requestAnimationFrame(() => document.getElementById(id)?.focus());
            }}
            className={chip(!selected && (otherOpen || custom))}
          >
            Other
          </button>
        )}
      </div>
      {showText && (
        <AutoGrowTextarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={
            withOther
              ? "Describe it in your own words"
              : "Add details, or describe it in your own words"
          }
          className={cn(controlClass, "mt-2 leading-relaxed", drafted && "border-primary/40")}
        />
      )}
      <PlaceholderHint value={value} />
    </div>
  );
}
