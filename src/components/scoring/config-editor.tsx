"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { Switch } from "@/components/ui/switch";
import { applyPlaybooksState } from "@/lib/hooks/use-playbooks";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { CalibrationStep } from "./calibration-step";
import { saveScoringConfig, updateTierLabels } from "@/lib/tauri/commands";
import type { ScoringTier, TierLabels } from "@/lib/tauri/types";
import type {
  DemandSignifier,
  ParsedScoringConfig,
  RequiredCharacteristic,
} from "@/lib/types/scoring";
import { cn } from "@/lib/utils";

interface ScoringConfigEditorProps {
  seed: Omit<ParsedScoringConfig, "id" | "createdAt" | "updatedAt"> & {
    id: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  playbookId: number;
  tierLabels: TierLabels;
}

type Config = ScoringConfigEditorProps["seed"];
type TierField = "tierHotMin" | "tierWarmMin" | "tierNurtureMin";

/** What's editable, for comparing against the last saved version */
function snapshot(config: Config, labels: TierLabels): string {
  return JSON.stringify({
    requiredCharacteristics: config.requiredCharacteristics,
    demandSignifiers: config.demandSignifiers,
    tiers: [config.tierHotMin, config.tierWarmMin, config.tierNurtureMin],
    labels,
  });
}

function tierOrderProblem(config: Config, labels: TierLabels): string | null {
  if (config.tierHotMin > 100 || config.tierNurtureMin < 1) {
    return "Scores run from 0 to 100.";
  }
  if (config.tierHotMin <= config.tierWarmMin) {
    return `${labels.hot} should start above ${labels.warm}.`;
  }
  if (config.tierWarmMin <= config.tierNurtureMin) {
    return `${labels.warm} should start above ${labels.nurture}.`;
  }
  return null;
}

export function ScoringConfigEditor({ seed, playbookId, tierLabels }: ScoringConfigEditorProps) {
  const [config, setConfig] = useState(() => seed);
  const [labels, setLabels] = useState(() => tierLabels);
  // Last saved version, which Discard returns to
  const [savedConfig, setSavedConfig] = useState(() => seed);
  const [savedLabels, setSavedLabels] = useState(() => tierLabels);
  const [showMissing, setShowMissing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const dirty = snapshot(config, labels) !== snapshot(savedConfig, savedLabels);
  const tierProblem = tierOrderProblem(config, labels);
  const hasUnnamed = [...config.requiredCharacteristics, ...config.demandSignifiers].some(
    (item) => item.enabled && !item.name.trim()
  );

  const discard = () => {
    setConfig(savedConfig);
    setLabels(savedLabels);
    setShowMissing(false);
  };

  // Once missing items are marked, move to the first one
  useEffect(() => {
    if (showMissing) document.querySelector<HTMLElement>("[data-missing=true]")?.focus();
  }, [showMissing]);

  const handleSave = () => {
    // Point at what's missing instead of saving criteria Claude can't use
    if (hasUnnamed || tierProblem) {
      setShowMissing(true);
      return;
    }

    setIsSaving(true);
    startTransition(async () => {
      try {
        const newId = await saveScoringConfig(
          config.name,
          JSON.stringify(config.requiredCharacteristics),
          JSON.stringify(config.demandSignifiers),
          config.tierHotMin,
          config.tierWarmMin,
          config.tierNurtureMin,
          config.id ?? undefined
        );
        const savedVersion = newId && !config.id ? { ...config, id: newId } : config;
        setConfig(savedVersion);
        setSavedConfig(savedVersion);
        // Tier names belong to the playbook rather than the criteria record
        const labelsChanged = (Object.keys(labels) as ScoringTier[]).some(
          (tier) => labels[tier] !== savedLabels[tier]
        );
        if (labelsChanged) {
          applyPlaybooksState(await updateTierLabels(playbookId, labels));
          setSavedLabels(labels);
        }
        setShowMissing(false);
        // Scores made before this save are now out of date
        void queryClient.invalidateQueries({ queryKey: queryKeys.calibration });
        toast.success("Fit criteria saved");
      } catch (error) {
        toast.error("Couldn't save fit criteria", {
          description: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      } finally {
        setIsSaving(false);
      }
    });
  };

  const saving = isPending || isSaving;

  return (
    <div className="flex-1 overflow-auto [scrollbar-gutter:stable]">
      <div className="max-w-3xl px-6 pt-6 pb-24 space-y-10">
        <p className="text-sm text-muted-foreground max-w-xl">
          When you score a company, Claude checks it against these criteria in order: the must-haves
          first, then each signal, and the total decides its tier.
        </p>

        <Step
          number={1}
          title="Must-haves"
          description={`Pass or fail. A company that fails any of these is marked ${labels.disqualified}, whatever else is true.`}
        >
          <CriteriaList
            items={config.requiredCharacteristics}
            onChange={(next) => setConfig((prev) => ({ ...prev, requiredCharacteristics: next }))}
            create={(): RequiredCharacteristic => ({
              id: `req-${Date.now()}`,
              name: "",
              description: "",
              enabled: true,
            })}
            addLabel="Add a must-have"
            namePlaceholder="e.g. Has the problem we solve"
            descriptionPlaceholder="What should Claude look for to decide pass or fail?"
            showMissing={showMissing}
          />
        </Step>

        <Step
          number={2}
          title="Signals"
          description="What makes a company a stronger fit. Claude scores each signal from 0 to 100, and importance sets how much it counts toward the total."
        >
          <CriteriaList
            items={config.demandSignifiers}
            onChange={(next) => setConfig((prev) => ({ ...prev, demandSignifiers: next }))}
            create={(): DemandSignifier => ({
              id: `sig-${Date.now()}`,
              name: "",
              description: "",
              weight: 5,
              enabled: true,
            })}
            addLabel="Add a signal"
            namePlaceholder="e.g. Talks publicly about the problem"
            descriptionPlaceholder="What evidence makes this score high or low?"
            showMissing={showMissing}
          />
        </Step>

        <Step
          number={3}
          title="Tiers"
          description="Where the total score lands decides the tier. Name the tiers in your own words; the names appear wherever scores do."
        >
          <TierScale
            hotMin={config.tierHotMin}
            warmMin={config.tierWarmMin}
            nurtureMin={config.tierNurtureMin}
            labels={labels}
            problem={tierProblem}
            onChange={(field, value) => setConfig((prev) => ({ ...prev, [field]: value }))}
            onLabelChange={(tier, value) => setLabels((prev) => ({ ...prev, [tier]: value }))}
          />
        </Step>

        <Step
          number={4}
          title="Check against companies you know"
          description="Pick a few companies you already have an opinion about and score them. If the criteria agree with you, they work. Where they don't, the reason shows what to change."
        >
          <CalibrationStep criteriaUnsaved={dirty} tierLabels={savedLabels} />
        </Step>
      </div>

      {/* Appears only when there's something to save */}
      <div
        className={cn(
          "sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        )}
        aria-hidden={!dirty}
      >
        <div className="max-w-3xl px-6 py-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex-1">
            {showMissing && (hasUnnamed || tierProblem)
              ? "Finish the marked items to save."
              : "You have unsaved changes."}
          </span>
          <Button variant="ghost" onClick={discard} disabled={saving} tabIndex={dirty ? 0 : -1}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={saving} tabIndex={dirty ? 0 : -1}>
            {saving && <IconLoader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${number}`} className="grid grid-cols-[1.5rem_1fr] gap-x-3">
      <span className="mt-0.5 flex size-6 items-center justify-center rounded-full border border-white/15 text-xs tabular-nums text-muted-foreground">
        {number}
      </span>
      <div>
        <h2 id={`step-${number}`} className="text-base font-medium">
          {title}
        </h2>
        <p className="mt-1 mb-4 max-w-xl text-xs/relaxed text-muted-foreground">{description}</p>
        {children}
      </div>
    </section>
  );
}

type Criterion = RequiredCharacteristic | DemandSignifier;

const hasWeight = (item: Criterion): item is DemandSignifier => "weight" in item;

function CriteriaList<T extends Criterion>({
  items,
  onChange,
  create,
  addLabel,
  namePlaceholder,
  descriptionPlaceholder,
  showMissing,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  create: () => T;
  addLabel: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  showMissing: boolean;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  // Share of the total for each enabled signal, so importance reads as a proportion
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + (item.enabled && hasWeight(item) ? item.weight : 0), 0),
    [items]
  );

  const update = (id: string, changes: Partial<T>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <CriterionCard
          key={item.id}
          item={item}
          autoFocus={item.id === focusId}
          share={
            hasWeight(item) && item.enabled && totalWeight > 0
              ? Math.round((item.weight / totalWeight) * 100)
              : null
          }
          namePlaceholder={namePlaceholder}
          descriptionPlaceholder={descriptionPlaceholder}
          missingName={showMissing && item.enabled && !item.name.trim()}
          onChange={(changes) => update(item.id, changes as Partial<T>)}
          onRemove={() => onChange(items.filter((other) => other.id !== item.id))}
        />
      ))}

      <button
        type="button"
        onClick={() => {
          const next = create();
          setFocusId(next.id);
          onChange([...items, next]);
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <IconPlus className="size-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

/** Text that reads like content and turns into a field on hover or focus */
const inlineField =
  "w-full rounded bg-transparent px-1.5 -mx-1.5 outline-none transition-colors border border-transparent hover:border-white/10 focus:border-white/20 focus:bg-white/[0.03] placeholder:text-muted-foreground/50";

function CriterionCard({
  item,
  autoFocus,
  share,
  namePlaceholder,
  descriptionPlaceholder,
  missingName,
  onChange,
  onRemove,
}: {
  item: Criterion;
  autoFocus: boolean;
  share: number | null;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  missingName: boolean;
  onChange: (changes: Partial<Criterion> & { weight?: number }) => void;
  onRemove: () => void;
}) {
  const label = item.name.trim() || "this criterion";

  return (
    <div
      className={cn(
        "group rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 transition-opacity",
        !item.enabled && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={item.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          aria-label={`Use ${label} when scoring`}
          title={item.enabled ? "Used when scoring" : "Not used when scoring"}
          className="mt-1"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <input
            value={item.name}
            autoFocus={autoFocus}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={namePlaceholder}
            aria-label="Name"
            data-missing={missingName}
            className={cn(inlineField, "py-0.5 text-sm font-medium text-foreground")}
          />
          {missingName && (
            <p className="px-0 text-[11px] text-yellow-500">
              Add a name so Claude knows what this is.
            </p>
          )}
          <AutoGrowTextarea
            value={item.description}
            onChange={(description) => onChange({ description })}
            placeholder={descriptionPlaceholder}
            aria-label={`What Claude checks for ${label}`}
            className={cn(inlineField, "py-1 text-xs/relaxed text-muted-foreground")}
          />
          {hasWeight(item) && (
            <ImportanceControl
              value={item.weight}
              share={share}
              disabled={!item.enabled}
              label={label}
              onChange={(weight) => onChange({ weight })}
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={`Delete ${label}`}
          className="text-muted-foreground/40 hover:text-red-400 group-hover:text-muted-foreground"
        >
          <IconTrash />
        </Button>
      </div>
    </div>
  );
}

const IMPORTANCE_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

/** 1–10 importance as a row of segments; arrow keys adjust it */
function ImportanceControl({
  value,
  share,
  disabled,
  label,
  onChange,
}: {
  value: number;
  share: number | null;
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] text-muted-foreground">Importance</span>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Importance of ${label}`}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(10, value + 1));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, value - 1));
        }}
        className="flex gap-0.5 rounded outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {IMPORTANCE_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => onChange(level)}
            aria-hidden
            className={cn(
              "h-3 w-2.5 rounded-[2px] transition-colors",
              level <= value ? "bg-primary" : "bg-white/10 hover:bg-white/25"
            )}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {value}/10{share !== null && ` · about ${share}% of the score`}
      </span>
    </div>
  );
}

const TIER_STYLES: Record<ScoringTier, { bar: string; dot: string }> = {
  disqualified: { bar: "bg-red-500/30", dot: "bg-red-500" },
  nurture: { bar: "bg-blue-500/30", dot: "bg-blue-500" },
  warm: { bar: "bg-yellow-500/30", dot: "bg-yellow-500" },
  hot: { bar: "bg-green-500/30", dot: "bg-green-500" },
};

function TierScale({
  hotMin,
  warmMin,
  nurtureMin,
  labels,
  problem,
  onChange,
  onLabelChange,
}: {
  hotMin: number;
  warmMin: number;
  nurtureMin: number;
  labels: TierLabels;
  problem: string | null;
  onChange: (field: TierField, value: number) => void;
  onLabelChange: (tier: ScoringTier, value: string) => void;
}) {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  // Lowest to highest, as the score scale reads left to right
  const tiers: { tier: ScoringTier; from: number; to: number; field?: TierField }[] = [
    { tier: "disqualified", from: 0, to: clamp(nurtureMin) },
    { tier: "nurture", from: clamp(nurtureMin), to: clamp(warmMin), field: "tierNurtureMin" },
    { tier: "warm", from: clamp(warmMin), to: clamp(hotMin), field: "tierWarmMin" },
    { tier: "hot", from: clamp(hotMin), to: 100, field: "tierHotMin" },
  ];
  const minimums: Record<TierField, number> = {
    tierNurtureMin: nurtureMin,
    tierWarmMin: warmMin,
    tierHotMin: hotMin,
  };

  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5" aria-hidden>
        {tiers.map(({ tier, from, to }) => (
          <div
            key={tier}
            className={cn("h-full transition-all", TIER_STYLES[tier].bar)}
            style={{ width: `${Math.max(to - from, 0)}%` }}
          />
        ))}
      </div>
      <div
        className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60"
        aria-hidden
      >
        <span>0</span>
        <span>100</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiers.map(({ tier, to, field }) => (
          <div
            key={tier}
            className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", TIER_STYLES[tier].dot)} />
              <input
                value={labels[tier]}
                maxLength={30}
                onChange={(e) => onLabelChange(tier, e.target.value)}
                aria-label={`Name of the ${tier === "hot" ? "top" : tier === "disqualified" ? "lowest" : tier} tier`}
                className={cn(inlineField, "py-0.5 text-sm font-medium text-foreground")}
              />
            </div>
            {field ? (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                From
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minimums[field]}
                  onChange={(e) => onChange(field, parseInt(e.target.value) || 0)}
                  aria-label={`Lowest score for ${labels[tier]}`}
                  className="w-12 rounded border border-white/10 bg-transparent px-1.5 py-0.5 text-xs tabular-nums text-foreground outline-none focus:border-white/25"
                />
                to {tier === "hot" ? 100 : Math.max(to - 1, minimums[field])}
              </label>
            ) : (
              <p className="text-[11px] text-muted-foreground">Below {to}, or fails a must-have</p>
            )}
          </div>
        ))}
      </div>

      {problem && (
        <p data-missing="true" tabIndex={-1} className="text-[11px] text-yellow-500 outline-none">
          {problem}
        </p>
      )}
    </div>
  );
}
