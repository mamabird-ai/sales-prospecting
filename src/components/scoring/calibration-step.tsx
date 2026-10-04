import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconCheck,
  IconLoader2,
  IconPlus,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { countItems } from "@/components/selection";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useLeadsWithScores } from "@/lib/hooks/use-leads";
import { useBusyEntities } from "@/lib/hooks/use-job-activity";
import { handleStreamEvent } from "@/lib/stream/handle-stream-event";
import { toastJobStarted } from "@/lib/stream/job-toasts";
import {
  scoreReason,
  summarizeCheck,
  type CheckRow,
  type ExpectedFit,
} from "@/lib/scoring/calibration";
import { getCalibration, setLeadExpectedFit, startScoring } from "@/lib/tauri/commands";
import type { TierLabels } from "@/lib/tauri/types";
import { cn } from "@/lib/utils";

const FIT_LABELS: Record<ExpectedFit, string> = { good: "Good fit", bad: "Bad fit" };

async function setFit(leadId: number, fit: ExpectedFit | null) {
  try {
    await setLeadExpectedFit(leadId, fit);
    await queryClient.invalidateQueries({ queryKey: queryKeys.calibration });
  } catch (error) {
    toast.error("Couldn't update the check", {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Companies the user already has an opinion about, scored with the current
 * criteria. Agreement shows the criteria work; disagreement shows what to change.
 */
export function CalibrationStep({
  criteriaUnsaved,
  tierLabels,
}: {
  criteriaUnsaved: boolean;
  tierLabels: TierLabels;
}) {
  const { data: calibration } = useQuery({
    queryKey: queryKeys.calibration,
    queryFn: getCalibration,
  });
  const { leads } = useLeadsWithScores();
  const busy = useBusyEntities("lead");
  const [starting, setStarting] = useState(false);

  const summary = useMemo(
    () =>
      summarizeCheck(calibration?.expectations ?? [], leads, calibration?.criteriaChangedAt ?? 0),
    [calibration, leads]
  );
  const marked = new Set(summary.rows.map((row) => row.leadId));
  const unmarked = leads.filter((lead) => !marked.has(lead.id));
  const toScore = summary.needScoring.filter((id) => !busy.has(id));
  const scoringNow = summary.rows.filter((row) => busy.has(row.leadId)).length;

  const scoreAll = async () => {
    setStarting(true);
    const results = await Promise.allSettled(
      toScore.map((id) => startScoring(id, handleStreamEvent))
    );
    setStarting(false);
    const started = results.filter((result) => result.status === "fulfilled").length;
    if (started > 0) toastJobStarted(`Scoring ${countItems(started, "lead")}`);
    if (started < results.length) {
      toast.error(`Couldn't start scoring for ${countItems(results.length - started, "lead")}`);
    }
  };

  return (
    <div className="space-y-4">
      {summary.rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Verdict summary={summary} scoringNow={scoringNow} />
          <div className="flex-1" />
          {criteriaUnsaved ? (
            <span className="text-[11px] text-muted-foreground">
              Save your changes first, so scores use them
            </span>
          ) : (
            toScore.length > 0 && (
              <Button size="sm" onClick={scoreAll} disabled={starting}>
                {starting && <IconLoader2 className="size-3.5 animate-spin" />}
                Score {countItems(toScore.length, "lead")}
              </Button>
            )
          )}
        </div>
      )}

      {summary.rows.length > 0 && (
        <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.07] bg-white/[0.02]">
          {summary.rows.map((row) => (
            <CheckRowItem
              key={row.leadId}
              row={row}
              scoring={busy.has(row.leadId)}
              tierLabels={tierLabels}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <AddCompany fit="good" companies={unmarked} />
        <AddCompany fit="bad" companies={unmarked} />
      </div>

      {leads.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          First add a few companies you know in{" "}
          <Link to="/lead" className="text-foreground underline underline-offset-2">
            Companies
          </Link>
          , then pick them here.
        </p>
      )}
    </div>
  );
}

function Verdict({
  summary,
  scoringNow,
}: {
  summary: ReturnType<typeof summarizeCheck>;
  scoringNow: number;
}) {
  const waiting = summary.rows.length - summary.current;

  if (summary.current === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {scoringNow > 0
          ? `Scoring ${countItems(scoringNow, "lead")}…`
          : "Score these companies to see whether the criteria agree with you."}
      </p>
    );
  }

  const allAgree = summary.agrees === summary.current;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" aria-hidden>
        {summary.rows.map((row) => (
          <span
            key={row.leadId}
            className={cn(
              "size-2 rounded-full",
              row.status === "agrees"
                ? "bg-green-500"
                : row.status === "disagrees"
                  ? "bg-red-500"
                  : "bg-white/15"
            )}
          />
        ))}
      </div>
      <p className="text-sm">
        <span className={cn("font-medium", allAgree ? "text-green-400" : "text-foreground")}>
          {summary.agrees} of {summary.current} agree with you
        </span>
        {waiting > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · {waiting} {scoringNow > 0 ? "being scored or " : ""}waiting for a score
          </span>
        )}
      </p>
    </div>
  );
}

function CheckRowItem({
  row,
  scoring,
  tierLabels,
}: {
  row: CheckRow;
  scoring: boolean;
  tierLabels: TierLabels;
}) {
  const reason = row.status === "disagrees" && row.score ? scoreReason(row.score) : null;

  return (
    <li className="group px-3 py-2.5">
      <div className="flex items-center gap-3">
        <AgreementIcon status={scoring ? "scoring" : row.status} />
        <Link
          to={`/lead/${row.leadId}`}
          className="min-w-0 flex-1 truncate text-sm hover:underline underline-offset-2"
        >
          {row.companyName}
        </Link>

        <FitToggle
          value={row.expectedFit}
          onChange={(fit) => setFit(row.leadId, fit)}
          company={row.companyName}
        />

        <span className="w-40 shrink-0 text-right text-xs text-muted-foreground">
          {scoring ? (
            "Scoring…"
          ) : row.status === "unscored" ? (
            "Not scored yet"
          ) : row.status === "outdated" ? (
            <span title="Scored before your last change to the criteria or Your company">
              Out of date
            </span>
          ) : (
            row.score && (
              <>
                Scored <span className="text-foreground">{tierLabels[row.score.tier]}</span>
                <span className="tabular-nums"> · {row.score.totalScore}</span>
              </>
            )
          )}
        </span>

        <button
          type="button"
          onClick={() => setFit(row.leadId, null)}
          aria-label={`Remove ${row.companyName} from the check`}
          className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground group-hover:text-muted-foreground"
        >
          <IconX className="size-3.5" />
        </button>
      </div>
      {reason && (
        <p className="mt-1.5 pl-7 pr-8 text-[11px]/relaxed text-muted-foreground line-clamp-3">
          {reason}
        </p>
      )}
    </li>
  );
}

function AgreementIcon({ status }: { status: CheckRow["status"] | "scoring" }) {
  if (status === "scoring") {
    return <IconLoader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  }
  if (status === "agrees") {
    return <IconCheck className="size-4 shrink-0 text-green-500" aria-label="Agrees with you" />;
  }
  if (status === "disagrees") {
    return <IconX className="size-4 shrink-0 text-red-500" aria-label="Disagrees with you" />;
  }
  return <span className="size-4 shrink-0 rounded-full border border-dashed border-white/20" />;
}

/** Good/bad as a two-option toggle, so switching a verdict is one click */
function FitToggle({
  value,
  onChange,
  company,
}: {
  value: ExpectedFit;
  onChange: (fit: ExpectedFit) => void;
  company: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Your call on ${company}`}
      className="flex shrink-0 rounded border border-white/10 p-0.5"
    >
      {(["good", "bad"] as const).map((fit) => (
        <button
          key={fit}
          type="button"
          role="radio"
          aria-checked={value === fit}
          onClick={() => value !== fit && onChange(fit)}
          className={cn(
            "rounded-sm px-2 py-0.5 text-[11px] transition-colors",
            value === fit
              ? fit === "good"
                ? "bg-green-500/15 text-green-300"
                : "bg-red-500/15 text-red-300"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {FIT_LABELS[fit]}
        </button>
      ))}
    </div>
  );
}

function AddCompany({
  fit,
  companies,
}: {
  fit: ExpectedFit;
  companies: { id: number; companyName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const Icon = fit === "good" ? IconThumbUp : IconThumbDown;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={companies.length === 0}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <IconPlus className="size-3.5" />
          <Icon className="size-3.5" />
          Add a company you know is a {FIT_LABELS[fit].toLowerCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search your companies…" />
          <CommandList>
            <CommandEmpty>No companies found.</CommandEmpty>
            {companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`${company.companyName} ${company.id}`}
                onSelect={() => {
                  setOpen(false);
                  void setFit(company.id, fit);
                }}
              >
                {company.companyName}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
