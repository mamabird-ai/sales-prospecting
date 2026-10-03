"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconDeviceFloppy, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { saveScoringConfig, updateTierLabels } from "@/lib/tauri/commands";
import { applyPlaybooksState } from "@/lib/hooks/use-playbooks";
import type { ScoringTier, TierLabels } from "@/lib/tauri/types";
import type {
  RequiredCharacteristic,
  DemandSignifier,
  ParsedScoringConfig,
} from "@/lib/types/scoring";

interface ScoringConfigEditorProps {
  seed: Omit<ParsedScoringConfig, "id" | "createdAt" | "updatedAt"> & {
    id: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  playbookId: number;
  tierLabels: TierLabels;
}

export function ScoringConfigEditor({ seed, playbookId, tierLabels }: ScoringConfigEditorProps) {
  const [config, setConfig] = useState(() => seed);
  const [labels, setLabels] = useState(() => tierLabels);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
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

        if (newId && !config.id) {
          setConfig((prev) => ({ ...prev, id: newId }));
        }
        // Tier names belong to the playbook rather than the criteria record
        const labelsChanged = (Object.keys(labels) as ScoringTier[]).some(
          (tier) => labels[tier] !== tierLabels[tier]
        );
        if (labelsChanged) {
          applyPlaybooksState(await updateTierLabels(playbookId, labels));
        }
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

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-3xl space-y-6">
        <RequirementsSection
          requirements={config.requiredCharacteristics}
          onChange={(next) => setConfig((prev) => ({ ...prev, requiredCharacteristics: next }))}
        />

        <SignifiersSection
          signifiers={config.demandSignifiers}
          onChange={(next) => setConfig((prev) => ({ ...prev, demandSignifiers: next }))}
        />

        <TierThresholdsSection
          hotMin={config.tierHotMin}
          warmMin={config.tierWarmMin}
          nurtureMin={config.tierNurtureMin}
          labels={labels}
          onChange={(field, value) => setConfig((prev) => ({ ...prev, [field]: value }))}
          onLabelChange={(tier, value) => setLabels((prev) => ({ ...prev, [tier]: value }))}
        />

        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <Button onClick={handleSave} disabled={isPending || isSaving}>
            {isPending || isSaving ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDeviceFloppy className="size-4" />
            )}
            {isPending || isSaving ? "Saving…" : "Save fit criteria"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequirementsSection({
  requirements,
  onChange,
}: {
  requirements: RequiredCharacteristic[];
  onChange: (next: RequiredCharacteristic[]) => void;
}) {
  const add = () => {
    const newReq: RequiredCharacteristic = {
      id: `req-${Date.now()}`,
      name: "",
      description: "",
      enabled: true,
    };
    onChange([...requirements, newReq]);
  };

  const update = (index: number, updates: Partial<RequiredCharacteristic>) => {
    onChange(requirements.map((req, i) => (i === index ? { ...req, ...updates } : req)));
  };

  const remove = (index: number) => {
    onChange(requirements.filter((_, i) => i !== index));
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium">Required Characteristics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pass/fail gates that must be met to qualify as a lead
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={add}>
          <IconPlus className="size-3.5 mr-1.5" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {requirements.map((req, index) => (
          <div
            key={req.id}
            className="group flex items-start gap-3 p-3 border border-white/5 rounded-lg hover:border-white/10 transition-colors"
          >
            <div className="flex-1 space-y-2">
              <Input
                value={req.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder="Requirement name"
                className="h-8 text-sm bg-transparent border-white/10"
              />
              <Input
                value={req.description}
                onChange={(e) => update(index, { description: e.target.value })}
                placeholder="Description (what the AI should check for)"
                className="h-8 text-sm bg-transparent border-white/10"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              onClick={() => remove(index)}
            >
              <IconTrash className="size-3.5 text-muted-foreground hover:text-red-400" />
            </Button>
          </div>
        ))}

        {requirements.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg">
            No required characteristics defined. Add one to get started.
          </div>
        )}
      </div>
    </section>
  );
}

function SignifiersSection({
  signifiers,
  onChange,
}: {
  signifiers: DemandSignifier[];
  onChange: (next: DemandSignifier[]) => void;
}) {
  const add = () => {
    const newSig: DemandSignifier = {
      id: `sig-${Date.now()}`,
      name: "",
      description: "",
      weight: 5,
      enabled: true,
    };
    onChange([...signifiers, newSig]);
  };

  const update = (index: number, updates: Partial<DemandSignifier>) => {
    onChange(signifiers.map((sig, i) => (i === index ? { ...sig, ...updates } : sig)));
  };

  const remove = (index: number) => {
    onChange(signifiers.filter((_, i) => i !== index));
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium">Demand Signifiers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weighted scoring factors that contribute to the lead score
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={add}>
          <IconPlus className="size-3.5 mr-1.5" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {signifiers.map((sig, index) => (
          <div
            key={sig.id}
            className="group flex items-start gap-3 p-3 border border-white/5 rounded-lg hover:border-white/10 transition-colors"
          >
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={sig.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Signifier name"
                  className="h-8 text-sm flex-1 bg-transparent border-white/10"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Weight:</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={sig.weight}
                    onChange={(e) => update(index, { weight: parseInt(e.target.value) || 1 })}
                    className="h-8 w-14 text-sm text-center bg-transparent border-white/10"
                  />
                </div>
              </div>
              <Input
                value={sig.description}
                onChange={(e) => update(index, { description: e.target.value })}
                placeholder="Description (what the AI should evaluate)"
                className="h-8 text-sm bg-transparent border-white/10"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              onClick={() => remove(index)}
            >
              <IconTrash className="size-3.5 text-muted-foreground hover:text-red-400" />
            </Button>
          </div>
        ))}

        {signifiers.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg">
            No demand signifiers defined. Add one to get started.
          </div>
        )}
      </div>
    </section>
  );
}

type TierField = "tierHotMin" | "tierWarmMin" | "tierNurtureMin";

function TierThresholdsSection({
  hotMin,
  warmMin,
  nurtureMin,
  labels,
  onChange,
  onLabelChange,
}: {
  hotMin: number;
  warmMin: number;
  nurtureMin: number;
  labels: TierLabels;
  onChange: (field: TierField, value: number) => void;
  onLabelChange: (tier: ScoringTier, value: string) => void;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium">Tiers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Name each tier and set the minimum score for it. Names show up wherever scores do.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TierCard
          tier="hot"
          dotColor="bg-green-500"
          label={labels.hot}
          onLabelChange={onLabelChange}
          threshold={{
            id: "tier-hot-min",
            value: hotMin,
            onChange: (v) => onChange("tierHotMin", v),
          }}
        />
        <TierCard
          tier="warm"
          dotColor="bg-yellow-500"
          label={labels.warm}
          onLabelChange={onLabelChange}
          threshold={{
            id: "tier-warm-min",
            value: warmMin,
            onChange: (v) => onChange("tierWarmMin", v),
          }}
        />
        <TierCard
          tier="nurture"
          dotColor="bg-blue-500"
          label={labels.nurture}
          onLabelChange={onLabelChange}
          threshold={{
            id: "tier-nurture-min",
            value: nurtureMin,
            onChange: (v) => onChange("tierNurtureMin", v),
          }}
        />
        <TierCard
          tier="disqualified"
          dotColor="bg-red-500"
          label={labels.disqualified}
          onLabelChange={onLabelChange}
          note={`Below ${nurtureMin}, or fails a required characteristic`}
        />
      </div>
    </section>
  );
}

const TIER_NAME_DESCRIPTIONS: Record<ScoringTier, string> = {
  hot: "Name of the top tier",
  warm: "Name of the second tier",
  nurture: "Name of the third tier",
  disqualified: "Name of the lowest tier",
};

function TierCard({
  tier,
  dotColor,
  label,
  onLabelChange,
  threshold,
  note,
}: {
  tier: ScoringTier;
  dotColor: string;
  label: string;
  onLabelChange: (tier: ScoringTier, value: string) => void;
  threshold?: { id: string; value: number; onChange: (value: number) => void };
  note?: string;
}) {
  return (
    <div className="p-3 border border-white/5 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
        <Input
          aria-label={TIER_NAME_DESCRIPTIONS[tier]}
          value={label}
          maxLength={30}
          onChange={(e) => onLabelChange(tier, e.target.value)}
          className="h-7 text-xs font-medium bg-transparent border-white/10"
        />
      </div>
      {threshold ? (
        <div className="space-y-1">
          <label htmlFor={threshold.id} className="block text-[11px] text-muted-foreground">
            Minimum score
          </label>
          <Input
            id={threshold.id}
            type="number"
            min={0}
            max={100}
            value={threshold.value}
            onChange={(e) => threshold.onChange(parseInt(e.target.value) || 0)}
            className="h-8 text-sm bg-transparent border-white/10"
          />
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
