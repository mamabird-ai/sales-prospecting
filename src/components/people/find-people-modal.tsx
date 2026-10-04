import { useState } from "react";
import { toast } from "sonner";
import { IconLoader2, IconUserSearch } from "@tabler/icons-react";
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
import { getPromptByType, startFindPeople } from "@/lib/tauri/commands";

/**
 * Find individuals rather than companies: people who are publicly active on
 * the problem, such as possible design partners
 */
export function FindPeopleModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    try {
      const result = await startFindPeople(description.trim(), handleStreamEvent);
      setOpen(false);
      setDescription("");
      toastJobStarted(
        "Finding people. They'll appear here when it's done, usually in a few minutes.",
        result.jobId
      );
    } catch (error) {
      toast.error("Couldn't start finding people", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
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
            Claude searches the public web for 10–20 people who match, such as LinkedIn posts that
            show up in search, articles, podcasts, and talks, and notes why each one fits with a
            link. It never logs in to LinkedIn; you reach out yourself.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="find-people-description">Who are you looking for?</Label>
            <Textarea
              id="find-people-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Product managers at B2B SaaS companies who post on LinkedIn about running beta programs or customer advisory boards"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Say what they do and what they talk about publicly. People who post about the problem
              from Your company are favored.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !description.trim()}>
              {loading && <IconLoader2 className="size-3.5 animate-spin" />}
              {loading ? "Starting…" : "Find people"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
