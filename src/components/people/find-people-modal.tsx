import { useState } from "react";
import { toast } from "sonner";
import { IconLoader2, IconSearch, IconUserSearch, IconWorldSearch } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseProfile } from "@/lib/company-profile";
import { handleStreamEvent } from "@/lib/stream/handle-stream-event";
import { toastJobStarted } from "@/lib/stream/job-toasts";
import { getPromptByType, startFindPeople, type SearchFocus } from "@/lib/tauri/commands";
import { cn } from "@/lib/utils";

type SearchSize = "standard" | "wide";

/** A wide search runs one search per part of the web, in parallel */
const WIDE_FOCUSES: SearchFocus[] = ["linkedin", "talks", "startups"];

const SIZES: {
  id: SearchSize;
  title: string;
  description: string;
  estimate: string;
  icon: typeof IconSearch;
}[] = [
  {
    id: "standard",
    title: "Standard",
    description: "One search across the web.",
    estimate: "About 10–25 people · up to ~$2 of usage",
    icon: IconSearch,
  },
  {
    id: "wide",
    title: "Wide",
    description: "Three searches at once: LinkedIn, talks and writing, and startup directories.",
    estimate: "About 30–60 people · up to ~$6 of usage",
    icon: IconWorldSearch,
  },
];

const SIZE_STORAGE_KEY = "find-people-size";

function rememberedSize(): SearchSize {
  try {
    return localStorage.getItem(SIZE_STORAGE_KEY) === "wide" ? "wide" : "standard";
  } catch {
    return "standard";
  }
}

/**
 * Find individuals rather than companies: people who are publicly active on
 * the problem, such as possible design partners
 */
export function FindPeopleModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<SearchSize>(rememberedSize);

  // Start from "Who's a great fit?" on Your company, so there's less to type
  const prefill = async () => {
    if (description.trim()) return;
    try {
      const overview = (await getPromptByType("company_overview"))?.content ?? "";
      const customer = parseProfile(overview).customer.trim();
      if (customer && !/\[[^\]]+\]/.test(customer)) setDescription(customer);
    } catch {
      // Prefilling is a convenience; an empty box works too
    }
  };

  const chooseSize = (next: SearchSize) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, next);
    } catch {
      // Remembering the choice is a convenience
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    const text = description.trim();
    const focuses: (SearchFocus | undefined)[] = size === "wide" ? WIDE_FOCUSES : [undefined];
    const results = await Promise.allSettled(
      focuses.map((focus) => startFindPeople(text, handleStreamEvent, focus))
    );
    setLoading(false);

    const started = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (started.length === 0) {
      const failure = results.find((r) => r.status === "rejected");
      const reason = failure?.status === "rejected" ? failure.reason : undefined;
      toast.error("Couldn't start finding people", {
        description: reason instanceof Error ? reason.message : reason ? String(reason) : undefined,
      });
      return;
    }

    setOpen(false);
    setDescription("");
    toastJobStarted(
      started.length > 1
        ? `Finding people with ${started.length} searches. They'll appear here as each finishes, usually within 15 minutes.`
        : "Finding people. They'll appear here when it's done, usually in a few minutes.",
      started[0].jobId
    );
    if (started.length < results.length) {
      toast.error(`${results.length - started.length} of the searches couldn't start`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void prefill();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconUserSearch className="size-3.5" />
          Find people
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Find people</DialogTitle>
          <DialogDescription>
            Claude searches the public web for people who match and notes why each one fits, with a
            link. Each is marked Strong fit or Worth a look. It never logs in to LinkedIn; you reach
            out yourself.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="find-people-description">Who are you looking for?</Label>
            <Textarea
              id="find-people-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Heads of Product, PMs, and founders at startups who post about customer interviews or running beta programs"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Say what they do and what they talk about publicly. The fewer must-haves you add (like
              company size), the more people it finds.
            </p>
          </div>

          <div role="radiogroup" aria-label="Search size" className="grid grid-cols-2 gap-2">
            {SIZES.map((option) => {
              const Icon = option.icon;
              const selected = size === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseSize(option.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded border p-3 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-white/[0.03]"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon
                      className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")}
                    />
                    {option.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                  <span className="text-[11px] text-muted-foreground/80">{option.estimate}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !description.trim()}>
              {loading && <IconLoader2 className="size-3.5 animate-spin" />}
              {loading ? "Starting…" : size === "wide" ? "Run wide search" : "Find people"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
