import { IconBuilding, IconFilter } from "@tabler/icons-react";
import { useMemo } from "react";
import { ListFilterBar } from "@/components/selection";
import { SmallEmptyState } from "@/components/ui/empty-state";
import { useListFilter, type FilterFacet } from "@/lib/hooks/use-list-filter";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { FindLeadsModal } from "@/components/leads/find-leads-modal";
import { LeadListWithSelection } from "@/components/leads/lead-list-with-selection";
import { useLeadsWithScores } from "@/lib/hooks/use-leads";
import type { LeadWithScore } from "@/lib/tauri/types";
import { useTierLabels } from "@/lib/hooks/use-playbooks";

// Helper to group leads by user status
function groupByUserStatus(leads: LeadWithScore[]) {
  const groups: Record<string, LeadWithScore[]> = {
    new: [],
    qualified: [],
    contacted: [],
    meeting: [],
    proposal: [],
    negotiating: [],
    won: [],
    lost: [],
    on_hold: [],
  };

  for (const lead of leads) {
    const status = lead.userStatus || "new";
    if (!groups[status]) groups[status] = [];
    groups[status].push(lead);
  }

  return groups;
}

const RESEARCH_FACET: FilterFacet<LeadWithScore> = {
  id: "research",
  label: "Research",
  options: [
    { id: "done", label: "Researched", matches: (l) => l.researchStatus === "completed" },
    { id: "todo", label: "Not researched", matches: (l) => l.researchStatus !== "completed" },
  ],
};

const searchText = (l: LeadWithScore) => [l.companyName, l.industry, l.city, l.state, l.website];

export default function LeadListPage() {
  const { leads: allLeads, isLoading, refresh } = useLeadsWithScores();
  const tierLabels = useTierLabels();

  // Tier chips use the playbook's own names, e.g. "Hot" or "Ideal partner"
  const facets = useMemo<FilterFacet<LeadWithScore>[]>(
    () => [
      {
        id: "tier",
        label: "Tier",
        options: [
          { id: "hot", label: tierLabels.hot, matches: (l) => l.score?.tier === "hot" },
          { id: "warm", label: tierLabels.warm, matches: (l) => l.score?.tier === "warm" },
          { id: "nurture", label: tierLabels.nurture, matches: (l) => l.score?.tier === "nurture" },
          {
            id: "disqualified",
            label: tierLabels.disqualified,
            matches: (l) => l.score?.tier === "disqualified",
          },
          { id: "unscored", label: "Unscored", matches: (l) => !l.score },
        ],
      },
      RESEARCH_FACET,
    ],
    [tierLabels]
  );
  const filter = useListFilter(allLeads, { searchText, facets });
  const groupedLeads = groupByUserStatus(filter.filtered);

  if (isLoading && allLeads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading leads…</p>
      </div>
    );
  }

  return (
    <>
      <header
        data-tauri-drag-region
        className="h-10 border-b border-white/5 flex items-center px-3 gap-1"
      >
        <div className="flex items-center rounded gap-1 px-2 py-1 bg-white/10 text-sm">
          <IconBuilding className="size-3.5" />
          <span>All Companies</span>
        </div>
        <div className="flex-1" data-tauri-drag-region />
        <FindLeadsModal onSuccess={refresh} />
        <AddLeadModal onSuccess={refresh} />
      </header>

      <LeadListWithSelection
        groupedLeads={groupedLeads}
        onRefresh={refresh}
        toolbar={<ListFilterBar filter={filter} placeholder="Search companies" />}
        emptyContent={
          filter.active && (
            <SmallEmptyState icon={IconFilter} message="No companies match these filters" />
          )
        }
      />
    </>
  );
}
