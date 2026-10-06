import { IconFilter, IconUsers, IconLoader2 } from "@tabler/icons-react";
import { useMemo } from "react";
import { ListFilterBar } from "@/components/selection";
import { SmallEmptyState } from "@/components/ui/empty-state";
import { useListFilter, type FilterFacet } from "@/lib/hooks/use-list-filter";
import { AddPersonModal } from "@/components/people/add-person-modal";
import { FindPeopleModal } from "@/components/people/find-people-modal";
import { PeopleListWithSelection } from "@/components/people/people-list-with-selection";
import { useAllPeople, useLeadsForSelect } from "@/lib/hooks/use-people";
import type { PersonWithCompany } from "@/lib/tauri/types";
import {
  PERSON_USER_STATUS_ORDER,
  type PersonUserStatusType,
  validatePersonUserStatus,
} from "@/lib/constants/status-config";

const FIT_FACET: FilterFacet<PersonWithCompany> = {
  id: "fit",
  label: "Fit",
  options: [
    { id: "strong", label: "Strong fit", matches: (p) => p.foundFit === "strong" },
    { id: "possible", label: "Worth a look", matches: (p) => p.foundFit === "possible" },
    { id: "untagged", label: "Untagged", matches: (p) => !p.foundFit },
  ],
};

const VERDICT_FACET: FilterFacet<PersonWithCompany> = {
  id: "verdict",
  label: "After research",
  options: [
    { id: "strong", label: "Fit confirmed", matches: (p) => p.researchFit === "strong" },
    { id: "possible", label: "Possible fit", matches: (p) => p.researchFit === "possible" },
    { id: "unlikely", label: "Not a fit", matches: (p) => p.researchFit === "unlikely" },
  ],
};

const RESEARCH_FACET: FilterFacet<PersonWithCompany> = {
  id: "research",
  label: "Research",
  options: [
    { id: "done", label: "Researched", matches: (p) => p.researchStatus === "completed" },
    { id: "todo", label: "Not researched", matches: (p) => p.researchStatus !== "completed" },
  ],
};

const searchText = (p: PersonWithCompany) => [p.firstName, p.lastName, p.title, p.companyName];

export default function PeopleListPage() {
  const { people: allPeople, isLoading, refresh } = useAllPeople();
  const { leads } = useLeadsForSelect();

  // Fit chips only appear once Find people has tagged someone, and verdict
  // chips once research has judged someone
  const facets = useMemo(
    () => [
      ...(allPeople.some((p) => p.foundFit) ? [FIT_FACET] : []),
      ...(allPeople.some((p) => p.researchFit) ? [VERDICT_FACET] : []),
      RESEARCH_FACET,
    ],
    [allPeople]
  );
  const filter = useListFilter(allPeople, { searchText, facets });
  const people = filter.filtered;

  // Group people by user status
  const groupedPeople = PERSON_USER_STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as Record<PersonUserStatusType, PersonWithCompany[]>
  );

  for (const person of people) {
    const status = validatePersonUserStatus(person.userStatus);
    // Create compatible object for PeopleListWithSelection
    const personForList = {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      title: person.title,
      email: person.email,
      linkedinUrl: person.linkedinUrl,
      leadId: person.leadId,
      companyName: person.companyName,
      researchStatus: person.researchStatus,
      userStatus: person.userStatus,
      foundFit: person.foundFit,
      researchFit: person.researchFit,
    };
    groupedPeople[status].push(personForList as PersonWithCompany);
  }

  if (isLoading && allPeople.length === 0) {
    return (
      <>
        <header
          data-tauri-drag-region
          className="h-10 border-b border-white/5 flex items-center px-3 gap-1"
        >
          <div className="flex items-center rounded gap-1 px-2 py-1 bg-white/10 text-sm">
            <IconUsers className="size-3.5" />
            <span>All People</span>
          </div>
        </header>
        <div className="flex items-center justify-center h-64">
          <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <header
        data-tauri-drag-region
        className="h-10 border-b border-white/5 flex items-center px-3 gap-1"
      >
        <div className="flex items-center rounded gap-1 px-2 py-1 bg-white/10 text-sm">
          <IconUsers className="size-3.5" />
          <span>All People</span>
        </div>
        <div className="flex-1" />
        <FindPeopleModal />
        <AddPersonModal leads={leads} onSuccess={refresh} />
      </header>

      <PeopleListWithSelection
        groupedPeople={groupedPeople}
        onRefresh={refresh}
        toolbar={<ListFilterBar filter={filter} placeholder="Search people" />}
        emptyContent={
          filter.active && (
            <SmallEmptyState icon={IconFilter} message="Nobody matches these filters" />
          )
        }
      />
    </>
  );
}
