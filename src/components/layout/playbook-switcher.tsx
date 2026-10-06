import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconHeartHandshake,
  IconPencil,
  IconPlus,
  IconTarget,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyPlaybooksState, useActivePlaybook, usePlaybooks } from "@/lib/hooks/use-playbooks";
import {
  createPlaybook,
  deletePlaybook,
  renamePlaybook,
  setActivePlaybook,
} from "@/lib/tauri/commands";
import type { Playbook, PlaybookSource } from "@/lib/tauri/types";
import { cn } from "@/lib/utils";

type DialogKind = "new" | "rename" | "delete" | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function countSummary(playbook: Playbook): string {
  const companies = `${playbook.leadCount} ${playbook.leadCount === 1 ? "company" : "companies"}`;
  const people = `${playbook.personCount} ${playbook.personCount === 1 ? "person" : "people"}`;
  return `${companies} · ${people}`;
}

/**
 * Switches between playbooks: separate lists, instructions, and fit criteria
 * for different goals, such as sales prospects and design partners.
 */
export function PlaybookSwitcher() {
  const { data } = usePlaybooks();
  const active = useActivePlaybook();
  const navigate = useNavigate();
  const location = useLocation();
  const [dialog, setDialog] = useState<DialogKind>(null);

  // A detail page belongs to the old playbook, so return to its list
  const leaveDetailPage = () => {
    const match = location.pathname.match(/^\/(lead|people)\/\d+/);
    if (match) navigate(`/${match[1]}`);
  };

  const switchTo = async (id: number) => {
    if (id === data?.activeId) return;
    try {
      applyPlaybooksState(await setActivePlaybook(id));
      leaveDetailPage();
    } catch (error) {
      toast.error("Couldn't switch playbooks", { description: errorMessage(error) });
    }
  };

  const playbooks = data?.playbooks ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Playbook: ${active?.name ?? "loading"}. Switch playbook`}
            className="flex items-center gap-2 w-full px-2 py-1 rounded font-medium hover:bg-white/5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <div className="size-6 shrink-0 flex rounded-md items-center justify-center bg-white/10 backdrop-blur">
              <img className="size-4" src="./menubar.png" alt="" />
            </div>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                Playbook
              </span>
              <span className="block truncate">{active?.name ?? "…"}</span>
            </span>
            <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Playbooks</DropdownMenuLabel>
          {playbooks.map((playbook) => (
            <DropdownMenuItem key={playbook.id} onSelect={() => switchTo(playbook.id)}>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{playbook.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {countSummary(playbook)}
                </span>
              </span>
              {playbook.id === data?.activeId && <IconCheck className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("new")}>
            <IconPlus />
            New playbook…
          </DropdownMenuItem>
          {active && (
            <>
              <DropdownMenuItem onSelect={() => setDialog("rename")}>
                <IconPencil />
                Rename “{active.name}”…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={playbooks.length <= 1}
                onSelect={() => setDialog("delete")}
              >
                <IconTrash />
                Delete “{active.name}”…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "new" && (
        <NewPlaybookDialog
          currentName={active?.name}
          onClose={() => setDialog(null)}
          onCreated={(source) => {
            setDialog(null);
            leaveDetailPage();
            if (source === "design_partners") navigate("/about");
          }}
        />
      )}
      {dialog === "rename" && active && (
        <RenamePlaybookDialog playbook={active} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && active && (
        <DeletePlaybookDialog
          playbook={active}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            leaveDetailPage();
          }}
        />
      )}
    </>
  );
}

const SOURCES: {
  id: PlaybookSource;
  title: string;
  description: string;
  defaultName: string;
  icon: typeof IconTarget;
}[] = [
  {
    id: "design_partners",
    title: "Design partners",
    description:
      "Find people who'll try your product and give feedback. Outreach asks for help, not a sale.",
    defaultName: "Design partners",
    icon: IconHeartHandshake,
  },
  {
    id: "sales",
    title: "Sales prospects",
    description: "Find and qualify potential customers with the default sales instructions.",
    defaultName: "Sales prospects",
    icon: IconTarget,
  },
  {
    id: "copy",
    title: "Copy current playbook",
    description: "Same instructions and fit criteria as your current playbook, with empty lists.",
    defaultName: "",
    icon: IconCopy,
  },
];

function NewPlaybookDialog({
  currentName,
  onClose,
  onCreated,
}: {
  currentName?: string;
  onClose: () => void;
  onCreated: (source: PlaybookSource) => void;
}) {
  const [source, setSource] = useState<PlaybookSource>("design_partners");
  const [name, setName] = useState("Design partners");
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const choose = (next: (typeof SOURCES)[number]) => {
    setSource(next.id);
    // Suggest a name until the user types their own
    if (!nameEdited) {
      setName(next.id === "copy" ? `${currentName ?? "Playbook"} copy` : next.defaultName);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      applyPlaybooksState(await createPlaybook(name, source));
      toast.success(`Created “${name.trim()}”`, {
        description:
          source === "design_partners"
            ? "Next, tell Claude about your company. It can draft it from your website."
            : undefined,
      });
      onCreated(source);
    } catch (error) {
      toast.error("Couldn't create the playbook", { description: errorMessage(error) });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New playbook</DialogTitle>
            <DialogDescription>
              A playbook keeps its own companies, people, research instructions, and fit criteria.
              Switch between playbooks from the top of the sidebar.
            </DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label="Start from" className="grid gap-2">
            {SOURCES.map((option) => {
              const Icon = option.icon;
              const selected = source === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex items-start gap-3 rounded border p-3 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-white/[0.03]"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {option.id === "copy" && currentName ? `Copy “${currentName}”` : option.title}
                    </span>
                    <span className="block text-muted-foreground">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="playbook-name">Name</Label>
            <Input
              id="playbook-name"
              value={name}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value);
                setNameEdited(true);
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Create playbook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenamePlaybookDialog({ playbook, onClose }: { playbook: Playbook; onClose: () => void }) {
  const [name, setName] = useState(playbook.name);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      applyPlaybooksState(await renamePlaybook(playbook.id, name));
      onClose();
    } catch (error) {
      toast.error("Couldn't rename the playbook", { description: errorMessage(error) });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename playbook</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="playbook-rename">Name</Label>
            <Input
              id="playbook-rename"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlaybookDialog({
  playbook,
  onClose,
  onDeleted,
}: {
  playbook: Playbook;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      applyPlaybooksState(await deletePlaybook(playbook.id));
      toast.success(`Deleted “${playbook.name}”`);
      onDeleted();
    } catch (error) {
      toast.error("Couldn't delete the playbook", { description: errorMessage(error) });
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{playbook.name}”?</DialogTitle>
          <DialogDescription>
            This deletes its {countSummary(playbook).replace(" · ", " and ")}, along with their
            research, scores, and talking points, plus the playbook&apos;s instructions and fit
            criteria. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            Delete playbook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
