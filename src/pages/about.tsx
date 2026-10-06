import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconBuildingStore,
  IconCheck,
  IconChevronDown,
  IconClipboardText,
  IconCopy,
  IconLoader2,
  IconMessageChatbot,
  IconSparkles,
  IconWorld,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/clipboard";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useActivePlaybook } from "@/lib/hooks/use-playbooks";
import {
  FIELDS,
  formatForAssistant,
  formatForCopy,
  hasPlaceholder,
  looksLikeProfile,
  parseProfile,
  readPasted,
  serializeProfile,
  type CompanyProfile,
  type FieldKey,
} from "@/lib/company-profile";
import { draftCompanyProfile, getPromptByType, savePromptByType } from "@/lib/tauri/commands";
import { cn } from "@/lib/utils";

const OVERVIEW_QUERY_KEY = ["prompts", "company_overview"] as const;

const STAGES = ["Idea", "Prototype", "Private beta", "Launched", "Growing"];
/** Where a field's current text came from, until the user edits or saves it */
type FillSource = "drafted" | "pasted";

/** The fields a website draft can fill; goal and notes depend on the user */
const DRAFTABLE: FieldKey[] = ["company", "product", "problem", "stage", "customer", "notFit"];

/** A draft only fills fields that are empty or still hold template text */
const canDraftInto = (value: string) => !value.trim() || hasPlaceholder(value);

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
  // Fields filled by a draft or a paste that the user hasn't touched since
  const [filled, setFilled] = useState<Map<FieldKey, FillSource>>(new Map());
  // Text waiting in the paste dialog; null when it's closed
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compare normalized forms so formatting differences don't count as edits
  const dirty = serializeProfile(profile) !== serializeProfile(parseProfile(saved));

  const set = (key: FieldKey, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
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
        (key) => filled[key] && canDraftInto(profile[key])
      );
      setProfile((prev) => ({
        ...prev,
        ...Object.fromEntries(keys.map((key) => [key, filled[key]])),
      }));
      setFilled(new Map(keys.map((key) => [key, "drafted" as const])));
      if (keys.length > 0) {
        toast.success(`Filled in ${keys.length} ${keys.length === 1 ? "field" : "fields"}`, {
          description:
            writtenCount > 0
              ? "Check the ones marked Drafted, then save. Fields with your own text weren't changed."
              : "Check the ones marked Drafted, then save.",
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
      setFilled(new Map());
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

  const copy = async (forAssistant: boolean) => {
    const text = forAssistant ? formatForAssistant(profile) : formatForCopy(profile);
    if (await copyText(text)) {
      toast.success(forAssistant ? "Copied with instructions" : "Copied", {
        description: forAssistant
          ? "Paste it into Claude or ChatGPT, add what you know, then paste the reply back here."
          : "Every field is included, so you can edit it anywhere and paste it back.",
      });
    } else {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  // A paste replaces only the fields it contains; the rest stay as they are
  const applyPaste = (pasted: CompanyProfile, found: FieldKey[]) => {
    setProfile((prev) => ({
      ...prev,
      ...Object.fromEntries(found.map((key) => [key, pasted[key]])),
    }));
    setFilled(new Map(found.map((key) => [key, "pasted" as const])));
    setPasteText(null);
    toast.success(`Filled in ${found.length} ${found.length === 1 ? "field" : "fields"}`, {
      description: "Check the ones marked Pasted, then save.",
    });
  };

  const openCount = DRAFTABLE.filter((key) => canDraftInto(profile[key])).length;
  const writtenCount = DRAFTABLE.length - openCount;
  const fieldsWord = (n: number) => `${n} ${n === 1 ? "field" : "fields"}`;
  const draftNote =
    writtenCount === 0
      ? "Claude reads your site and fills in the fields below. Nothing is saved until you review it."
      : openCount === 0
        ? "Every field is filled in, so there's nothing to fill. Clear a field if you want Claude to draft it."
        : `Fills only the ${fieldsWord(openCount)} that ${openCount === 1 ? "is" : "are"} empty. Never changes what you've written: the ${fieldsWord(writtenCount)} with your text stay as they are.`;

  const field = (key: FieldKey) => ({
    label: FIELDS[key].label,
    value: profile[key],
    onChange: (value: string) => set(key, value),
    source: filled.get(key),
    // Pasting a whole profile into any field offers to spread it across them
    onPasteText: (text: string) => {
      if (!looksLikeProfile(text)) return false;
      setPasteText(text);
      return true;
    },
  });

  return (
    <div className="flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="max-w-2xl px-6 pt-8 pb-28">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-lg font-medium">Tell Claude about your company</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconCopy />
                Copy
                <IconChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onSelect={() => copy(false)} className="items-start">
                <IconCopy className="mt-0.5" />
                <span>
                  <span className="block">Copy profile</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Every field as text, to edit anywhere and paste back
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => copy(true)} className="items-start">
                <IconMessageChatbot className="mt-0.5" />
                <span>
                  <span className="block">Copy for an AI assistant</span>
                  <span className="block text-[11px] text-muted-foreground">
                    With a request to improve it. Paste into Claude, add what you know.
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setPasteText("")}>
            <IconClipboardText />
            Paste
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude reads this before every search, research, message, and score
          {playbook ? ` in ${playbook.name}` : ""}. Fill it in below, paste it from anywhere, or let
          Claude draft it from your website.
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
            {drafting ? "Usually takes under a minute. You can keep editing meanwhile." : draftNote}
          </p>
        </div>

        <FormSection title="Your company">
          <TextField {...field("company")} single autoComplete="organization" />
          <TextField
            help="One or two sentences, the way you'd explain it to a customer."
            {...field("product")}
          />
          <TextField
            help="The pain in your customers' words, and how they handle it today."
            {...field("problem")}
          />
          <ChoiceField choices={STAGES} withOther {...field("stage")} />
        </FormSection>

        <FormSection title="Who you're looking for">
          <ChoiceField
            help="Pick one, then add details if you like."
            choices={GOALS}
            {...field("goal")}
          />
          <TextField
            help="Roles, company size, and signs they need what you make."
            {...field("customer")}
          />
          <TextField
            optional
            help="Who to skip, so research doesn't spend time on them."
            {...field("notFit")}
          />
        </FormSection>

        <FormSection title="Anything else">
          <TextField
            optional
            help="Pricing, competitors, words to avoid, anything that helps."
            {...field("notes")}
          />
        </FormSection>
      </div>

      {pasteText !== null && (
        <PasteDialog
          initial={pasteText}
          current={profile}
          onClose={() => setPasteText(null)}
          onApply={applyPaste}
        />
      )}

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
            {filled.size > 0
              ? "Review the fields marked Drafted or Pasted, then save."
              : "You have unsaved changes."}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              setProfile(parseProfile(saved));
              setFilled(new Map());
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
  source?: FillSource;
  /** Return true to take over a paste, e.g. a whole profile */
  onPasteText?: (text: string) => boolean;
}

/** Hand pasted text to the form first, so a whole profile can fill every field */
const pasteHandler = (onPasteText?: (text: string) => boolean) => (e: React.ClipboardEvent) => {
  if (onPasteText?.(e.clipboardData.getData("text/plain"))) e.preventDefault();
};

const SOURCE_BADGES: Record<
  FillSource,
  { label: string; title: string; icon: typeof IconSparkles }
> = {
  drafted: {
    label: "Drafted",
    title: "Filled in from your website. Check it, then save.",
    icon: IconSparkles,
  },
  pasted: {
    label: "Pasted",
    title: "Filled in from what you pasted. Check it, then save.",
    icon: IconClipboardText,
  },
};

function FieldLabel({
  id,
  label,
  optional,
  source,
}: {
  id: string;
  label: string;
  optional?: boolean;
  source?: FillSource;
}) {
  const badge = source ? SOURCE_BADGES[source] : null;
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
      {label}
      {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      {badge && (
        <span
          className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          title={badge.title}
        >
          <badge.icon className="size-3" />
          {badge.label}
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
  source,
  onPasteText,
  single,
  autoComplete,
}: FieldProps & { single?: boolean; autoComplete?: string }) {
  const id = useId();
  const onPaste = pasteHandler(onPasteText);
  return (
    <div>
      <FieldLabel id={id} label={label} optional={optional} source={source} />
      {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      <div className="mt-2">
        {single ? (
          <Input
            id={id}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            className={cn(controlClass, "h-9 py-0 md:text-sm", source && "border-primary/40")}
          />
        ) : (
          <AutoGrowTextarea
            id={id}
            value={value}
            onChange={onChange}
            onPaste={onPaste}
            className={cn(
              controlClass,
              "min-h-[4.5rem] leading-relaxed",
              source && "border-primary/40"
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
  source,
  onPasteText,
}: FieldProps & { choices: string[]; withOther?: boolean }) {
  const id = useId();
  const onPaste = pasteHandler(onPasteText);
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
      <FieldLabel id={id} label={label} source={source} />
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
          onPaste={onPaste}
          placeholder={
            withOther
              ? "Describe it in your own words"
              : "Add details, or describe it in your own words"
          }
          className={cn(controlClass, "mt-2 leading-relaxed", source && "border-primary/40")}
        />
      )}
      <PlaceholderHint value={value} />
    </div>
  );
}

/**
 * Paste a profile from anywhere (an AI assistant, a doc, an earlier copy) and
 * preview which fields it fills before applying it
 */
function PasteDialog({
  initial,
  current,
  onClose,
  onApply,
}: {
  initial: string;
  current: CompanyProfile;
  onClose: () => void;
  onApply: (profile: CompanyProfile, found: FieldKey[]) => void;
}) {
  const [text, setText] = useState(initial);
  const { profile, found } = useMemo(() => readPasted(text), [text]);
  const replaces = (key: FieldKey) =>
    current[key].trim() !== "" && current[key].trim() !== profile[key].trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste your company profile</DialogTitle>
          <DialogDescription>
            Paste text from Claude, ChatGPT, or a doc. Headings like “What do you make?” tell the
            app which field each part belongs in. Fields that aren&apos;t in the paste stay as they
            are.
          </DialogDescription>
        </DialogHeader>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Press ⌘V to paste"
          aria-label="Profile to paste"
          className={cn(controlClass, "h-40 resize-none font-mono text-xs leading-relaxed")}
        />

        {found.length > 0 ? (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Found {found.length} {found.length === 1 ? "field" : "fields"}:
            </p>
            <ul className="max-h-48 space-y-1.5 overflow-auto">
              {found.map((key) => (
                <li key={key} className="flex items-start gap-2 text-xs">
                  <IconCheck className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground">{FIELDS[key].label}</span>
                    <span className="block truncate text-muted-foreground">
                      {profile[key].replace(/\s+/g, " ")}
                    </span>
                  </span>
                  {replaces(key) && (
                    <span className="shrink-0 text-[11px] text-yellow-500/90">
                      replaces your text
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {text.trim()
              ? "Couldn't tell which fields this belongs to. Add headings that match the questions, like “What do you make?”."
              : "Tip: use Copy › Copy for an AI assistant, improve it in Claude, then paste the reply here."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onApply(profile, found)} disabled={found.length === 0}>
            Fill in {found.length > 0 ? found.length : ""} {found.length === 1 ? "field" : "fields"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
