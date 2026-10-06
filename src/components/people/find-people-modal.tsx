import { useState } from "react";
import { toast } from "sonner";
import {
  IconHistory,
  IconLoader2,
  IconSearch,
  IconUserSearch,
  IconWorldSearch,
} from "@tabler/icons-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { parseProfile } from "@/lib/company-profile";
import { handleStreamEvent } from "@/lib/stream/handle-stream-event";
import { toastJobStarted } from "@/lib/stream/job-toasts";
import {
  createPeopleSearch,
  deletePeopleSearch,
  getPeopleSearches,
  getPromptByType,
  startFindPeople,
  type SearchFocus,
} from "@/lib/tauri/commands";
import type { PeopleSearch, PeopleSearchSize } from "@/lib/tauri/types";
import { cn } from "@/lib/utils";

/** A wide search runs one search per part of the web, in parallel */
const WIDE_FOCUSES: SearchFocus[] = ["linkedin", "talks", "startups"];

const SIZES: {
  id: PeopleSearchSize;
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

function rememberedSize(): PeopleSearchSize {
  try {
    return localStorage.getItem(SIZE_STORAGE_KEY) === "wide" ? "wide" : "standard";
  } catch {
    return "standard";
  }
}

/** "Today", "Yesterday", "5 days ago", or the date for older searches */
function describeWhen(createdAtSeconds: number): string {
  const days = Math.floor((Date.now() / 1000 - createdAtSeconds) / 86_400);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return new Date(createdAtSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** One line on what a past search turned up */
function describeOutcome(search: PeopleSearch): string {
  const parts = [
    describeWhen(search.createdAt),
    search.size === "wide" ? "Wide" : "Standard",
    search.peopleFound === 0
      ? "Nobody found yet"
      : `${search.peopleFound} found · ${search.strongFits} strong fit`,
  ];
  if (search.peopleActedOn > 0) parts.push(`${search.peopleActedOn} acted on`);
  return parts.join(" · ");
}

/**
 * Find individuals rather than companies: people who are publicly active on
 * the problem, such as possible design partners
 */
export function FindPeopleModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<PeopleSearchSize>(rememberedSize);
  const [recent, setRecent] = useState<PeopleSearch[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);

  // Start from the last search in this playbook, or failing that from
  // "Who's a great fit?" on Your company, so there's less to type
  const prefill = async () => {
    let searches: PeopleSearch[] = [];
    try {
      searches = await getPeopleSearches();
      setRecent(searches);
    } catch {
      // History is a convenience; the box still works without it
    }
    if (description.trim()) return;
    if (searches[0]) {
      setDescription(searches[0].description);
      return;
    }
    try {
      const overview = (await getPromptByType("company_overview"))?.content ?? "";
      const customer = parseProfile(overview).customer.trim();
      if (customer && !/\[[^\]]+\]/.test(customer)) setDescription(customer);
    } catch {
      // Prefilling is a convenience; an empty box works too
    }
  };

  const chooseSize = (next: PeopleSearchSize) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, next);
    } catch {
      // Remembering the choice is a convenience
    }
  };

  const reuse = (search: PeopleSearch) => {
    setDescription(search.description);
    chooseSize(search.size);
    setRecentOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    const text = description.trim();

    // The search is recorded first so each job can tie the people it finds to it
    let searchId: number | undefined;
    try {
      searchId = await createPeopleSearch(text, size);
    } catch {
      // Without a record the search still runs; it just won't appear in Recent
    }

    const focuses: (SearchFocus | undefined)[] = size === "wide" ? WIDE_FOCUSES : [undefined];
    const results = await Promise.allSettled(
      focuses.map((focus) => startFindPeople(text, handleStreamEvent, focus, searchId))
    );
    setLoading(false);

    const started = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (started.length === 0) {
      if (searchId !== undefined) void deletePeopleSearch(searchId).catch(() => {});
      const failure = results.find((r) => r.status === "rejected");
      const reason = failure?.status === "rejected" ? failure.reason : undefined;
      toast.error("Couldn't start finding people", {
        description: reason instanceof Error ? reason.message : reason ? String(reason) : undefined,
      });
      return;
    }

    setOpen(false);
    // The box opens with this description next time, from Recent searches
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
            <div className="flex items-center justify-between">
              <Label htmlFor="find-people-description">Who are you looking for?</Label>
              {recent.length > 0 && (
                <Popover open={recentOpen} onOpenChange={setRecentOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      <IconHistory className="size-3.5" />
                      Recent searches
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-2rem)] p-1">
                    <ul className="max-h-72 overflow-y-auto" aria-label="Recent searches">
                      {recent.map((search) => (
                        <li key={search.id}>
                          <button
                            type="button"
                            onClick={() => reuse(search)}
                            className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left outline-none hover:bg-white/[0.04] focus-visible:bg-white/[0.04]"
                          >
                            <span className="line-clamp-2 text-xs text-foreground">
                              {search.description}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {describeOutcome(search)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
            </div>
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
