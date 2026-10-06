import { Link } from "react-router-dom";
import { IconBuilding, IconTrash, IconSearch, IconMessage } from "@tabler/icons-react";
import { SelectableEntityList, SelectableRow, countItems } from "@/components/selection";
import type { ActionConfig } from "@/components/selection";
import { toast } from "sonner";
import { toastJobStarted } from "@/lib/stream/job-toasts";
import { useSelectionStore } from "@/lib/store/selection-store";
import {
  deletePeople,
  startPersonResearch,
  startConversationGeneration,
} from "@/lib/tauri/commands";
import { handleStreamEvent } from "@/lib/stream/handle-stream-event";
import {
  PERSON_USER_STATUS_CONFIG,
  PERSON_USER_STATUS_ORDER,
  type PersonUserStatusType,
  validatePersonUserStatus,
} from "@/lib/constants/status-config";
import { ResearchStatusBadge } from "@/components/status/research-status-badge";
import { useMemo, useCallback, type ReactNode } from "react";

type PersonWithCompany = {
  id: number;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  leadId: number | null;
  companyName: string | null;
  researchStatus: string | null;
  userStatus: string | null;
  foundFit?: "strong" | "possible" | null;
};

interface PeopleListWithSelectionProps {
  groupedPeople: Record<PersonUserStatusType, PersonWithCompany[]>;
  onRefresh?: () => void;
  /** Toolbar content shown when nothing is selected */
  toolbar?: ReactNode;
}

export function PeopleListWithSelection({
  groupedPeople,
  onRefresh,
  toolbar,
}: PeopleListWithSelectionProps) {
  const clearSelection = useSelectionStore((state) => state.clearAll);

  // Create a map for quick person name lookups
  const personMap = useMemo(() => {
    const map = new Map<number, PersonWithCompany>();
    Object.values(groupedPeople)
      .flat()
      .forEach((person) => map.set(person.id, person));
    return map;
  }, [groupedPeople]);

  const handleResearch = useCallback(
    async (selectedIds: number[]) => {
      const promises: Promise<boolean>[] = [];
      for (const personId of selectedIds) {
        if (!personMap.has(personId)) continue;
        promises.push(
          (async () => {
            try {
              await startPersonResearch(personId, handleStreamEvent);
              return true;
            } catch (error) {
              console.error(`Failed to start research for person ${personId}:`, error);
              return false;
            }
          })()
        );
      }
      const results = await Promise.all(promises);

      let started = 0;
      let failed = 0;
      for (const ok of results) {
        if (ok) started++;
        else failed++;
      }

      if (started > 0) {
        toastJobStarted(`Started research for ${countItems(started, "person")}`);
      }
      if (failed > 0) {
        toast.error(`Couldn't start research for ${countItems(failed, "person")}`);
      }
    },
    [personMap]
  );

  const handleConversation = useCallback(
    async (selectedIds: number[]) => {
      const promises: Promise<boolean>[] = [];
      for (const personId of selectedIds) {
        if (!personMap.has(personId)) continue;
        promises.push(
          (async () => {
            try {
              await startConversationGeneration(personId, handleStreamEvent);
              return true;
            } catch (error) {
              console.error(
                `Failed to start conversation generation for person ${personId}:`,
                error
              );
              return false;
            }
          })()
        );
      }
      const results = await Promise.all(promises);

      let started = 0;
      let failed = 0;
      for (const ok of results) {
        if (ok) started++;
        else failed++;
      }

      if (started > 0) {
        toastJobStarted(`Started talking points for ${countItems(started, "person")}`);
      }
      if (failed > 0) {
        toast.error(`Couldn't start talking points for ${countItems(failed, "person")}`);
      }
    },
    [personMap]
  );

  const handleDelete = useCallback(
    async (selectedIds: number[]) => {
      try {
        const deleted = await deletePeople(selectedIds);
        clearSelection();
        onRefresh?.();
        toast.success(`Deleted ${countItems(deleted, "person")}`);
      } catch (error) {
        console.error("Failed to delete people:", error);
        toast.error("Couldn't delete the selected people");
      }
    },
    [clearSelection, onRefresh]
  );

  const actions: ActionConfig[] = useMemo(
    () => [
      {
        id: "research",
        label: "Research",
        icon: IconSearch,
        group: "Research",
        jobType: "person_research",
        confirm: { title: (items) => `Research ${items}?`, actionLabel: "Start research" },
        onExecute: handleResearch,
      },
      {
        id: "conversation",
        label: "Generate topics",
        icon: IconMessage,
        group: "Research",
        jobType: "conversation",
        confirm: {
          title: (items) => `Generate talking points for ${items}?`,
          actionLabel: "Generate topics",
        },
        onExecute: handleConversation,
      },
      {
        id: "delete",
        label: "Delete",
        icon: IconTrash,
        group: "Danger",
        destructive: true,
        confirm: {
          title: (items) => `Delete ${items}?`,
          actionLabel: "Delete",
          description: "Their research and talking points are deleted too. This can't be undone.",
        },
        onExecute: handleDelete,
      },
    ],
    [handleResearch, handleConversation, handleDelete]
  );

  return (
    <SelectableEntityList
      entityType="person"
      groupedItems={groupedPeople}
      statusOrder={PERSON_USER_STATUS_ORDER}
      configType="person_user"
      getItemId={(person) => person.id}
      renderRow={(person) => <PersonRow person={person} />}
      actions={actions}
      toolbar={toolbar}
    />
  );
}

function PersonRow({ person }: { person: PersonWithCompany }) {
  const userStatus = validatePersonUserStatus(person.userStatus);
  const userConfig = PERSON_USER_STATUS_CONFIG[userStatus];
  const StatusIcon = userConfig.icon;

  const fullName = `${person.firstName} ${person.lastName}`;

  return (
    <SelectableRow id={person.id}>
      <StatusIcon className={`size-4 ${userConfig.color} shrink-0`} />

      <Link to={`/people/${person.id}`} className="flex-1 min-w-0 truncate">
        <span className="font-medium">{fullName}</span>
        {person.title && <span className="text-muted-foreground ml-2">{person.title}</span>}
      </Link>

      {person.leadId && person.companyName ? (
        <Link
          to={`/lead/${person.leadId}`}
          className="w-48 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconBuilding className="size-3.5 shrink-0" />
          <span className="truncate">{person.companyName}</span>
        </Link>
      ) : (
        <div className="w-48 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <IconBuilding className="size-3.5 shrink-0" />
          <span className="truncate italic">No company</span>
        </div>
      )}

      {/* Always the same width, so the company column lines up on rows without a tag */}
      <span className="flex w-24 shrink-0 justify-end">
        {person.foundFit && <FitTag fit={person.foundFit} />}
      </span>
      <ResearchStatusBadge status={person.researchStatus} size="sm" />
    </SelectableRow>
  );
}

/** How well Find people thought someone matched, so strong ones stand out */
function FitTag({ fit }: { fit: "strong" | "possible" }) {
  return (
    <span
      className={
        fit === "strong"
          ? "shrink-0 rounded bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-400"
          : "shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-muted-foreground"
      }
    >
      {fit === "strong" ? "Strong fit" : "Worth a look"}
    </span>
  );
}
