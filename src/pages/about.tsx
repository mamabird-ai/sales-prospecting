import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconLoader2,
  IconUserCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { useActivePlaybook } from "@/lib/hooks/use-playbooks";
import { getPromptByType, savePromptByType } from "@/lib/tauri/commands";

const OVERVIEW_QUERY_KEY = ["prompts", "company_overview"] as const;

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
  const [content, setContent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = content !== initial;
  const hasPlaceholders = /\[[^\]\n]+\]/.test(content);

  const save = async () => {
    setSaving(true);
    try {
      await savePromptByType("company_overview", content);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prompts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() }),
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

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-3xl space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Describe what you&apos;re building and who you&apos;re looking for. Every research,
            scoring, and outreach job in{" "}
            {playbook ? <strong>{playbook.name}</strong> : "this playbook"} reads this, so the more
            specific it is, the better the results.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Include what your product does, the problem it solves, who&apos;s a great fit, and who
            isn&apos;t.
          </p>
        </div>

        {hasPlaceholders && (
          <div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            <IconAlertTriangle className="size-4 shrink-0 text-yellow-500" />
            <span>
              Replace the <strong>[bracketed]</strong> parts with your own details. Until you do,
              research will read them literally.
            </span>
          </div>
        )}

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          aria-label="About you"
          placeholder="What you're building, the problem it solves, and who you're looking for…"
          className="w-full h-[28rem] bg-white/5 border border-white/5 p-3 text-xs font-mono resize-none rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
