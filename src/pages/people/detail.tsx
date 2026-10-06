import { useParams, Navigate, Link } from "react-router-dom";
import {
  IconBuilding,
  IconBrandLinkedin,
  IconMail,
  IconCalendar,
  IconBriefcase,
  IconUser,
  IconCircleCheck,
  IconExternalLink,
  IconLoader2,
} from "@tabler/icons-react";
import { PersonProfileTabs } from "@/components/people/person-profile-tabs";
import { UserStatusSelector } from "@/components/status/user-status-selector";
import { ResearchStatusBadge } from "@/components/status/research-status-badge";
import { ResearchFitTag } from "@/components/people/research-fit-tag";
import type { ResearchFit } from "@/lib/tauri/types";
import { validatePersonUserStatus } from "@/lib/constants/status-config";
import {
  EntityDetailLayout,
  ActivityItem,
  SidebarSection,
  SidebarProperty,
} from "@/components/layout/entity-detail-layout";
import { usePersonDetail } from "@/lib/hooks/use-people";
import { formatShortDate } from "@/lib/utils";

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const personId = parseInt(id || "", 10);

  const { person, adjacentPeople, isLoading, error } = usePersonDetail(personId);

  if (isNaN(personId)) {
    return <Navigate to="/people" replace />;
  }

  if (isLoading && !person) {
    return (
      <div className="flex items-center justify-center h-screen">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !person) {
    return <Navigate to="/people" replace />;
  }

  const fullName = `${person.firstName} ${person.lastName}`;
  const userStatus = validatePersonUserStatus(person.userStatus);

  const subtitle = (
    <>
      {person.title && <span>{person.title}</span>}
      {person.title && person.companyName && <span> at </span>}
      {person.leadId && person.companyName ? (
        <Link to={`/lead/${person.leadId}`} className="hover:text-foreground transition-colors">
          {person.companyName}
        </Link>
      ) : !person.title ? (
        <span className="text-muted-foreground/70 italic">No company</span>
      ) : null}
    </>
  );

  const activityContent = (
    <>
      {person.researchedAt && (
        <ActivityItem
          icon={<IconCircleCheck className="size-3.5 text-green-500" />}
          iconBgColor="bg-green-500/20"
          label="Research completed"
          timestamp={person.researchedAt}
        />
      )}
      <ActivityItem
        icon={<IconUser className="size-3.5 text-primary" />}
        iconBgColor="bg-primary/20"
        label="Person added"
        timestamp={person.createdAt}
      />
    </>
  );

  const sidebarContent = (
    <>
      <SidebarSection title="Status">
        <UserStatusSelector type="person" entityId={person.id} currentStatus={userStatus} />
      </SidebarSection>

      {person.researchFit && (
        <ResearchVerdict fit={person.researchFit} reason={person.researchFitReason} />
      )}

      {person.foundBecause && <FoundBecause text={person.foundBecause} fit={person.foundFit} />}

      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Person
      </h3>

      <div className="space-y-4">
        <SidebarProperty label="Research">
          <ResearchStatusBadge status={person.researchStatus} showLabel size="md" />
        </SidebarProperty>

        {person.title && (
          <SidebarProperty label="Title">
            <div className="flex items-center gap-1.5 text-sm">
              <IconBriefcase className="size-4 text-muted-foreground" />
              <span>{person.title}</span>
            </div>
          </SidebarProperty>
        )}

        {person.managementLevel && (
          <SidebarProperty label="Level">
            <span className="inline-flex px-2 py-0.5 rounded bg-white/5 text-xs">
              {person.managementLevel}
            </span>
          </SidebarProperty>
        )}

        {person.yearJoined && (
          <SidebarProperty label="Joined">
            <div className="flex items-center gap-1.5 text-sm">
              <IconCalendar className="size-4 text-muted-foreground" />
              <span>{person.yearJoined}</span>
            </div>
          </SidebarProperty>
        )}

        <div className="border-t border-white/5 pt-4 mt-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Company
          </h4>
          {person.leadId && person.companyName ? (
            <>
              <Link
                to={`/lead/${person.leadId}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconBuilding className="size-4" />
                <span>{person.companyName}</span>
              </Link>
              {person.companyIndustry && (
                <div className="mt-2 text-xs text-muted-foreground/70">
                  {person.companyIndustry}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
              <IconBuilding className="size-4" />
              <span className="italic">No company</span>
            </div>
          )}
        </div>

        {(person.email || person.linkedinUrl) && (
          <div className="border-t border-white/5 pt-4 mt-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Contact
            </h4>
            <div className="space-y-2">
              {person.email && (
                <a
                  href={`mailto:${person.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconMail className="size-4" />
                  <span className="truncate">{person.email}</span>
                </a>
              )}
              {person.linkedinUrl && (
                <a
                  href={person.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconBrandLinkedin className="size-4" />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        )}

        {person.researchedAt && (
          <div className="border-t border-white/5 pt-4 mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconCalendar className="size-3.5" />
              <span>Researched {formatShortDate(person.researchedAt)}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <EntityDetailLayout
      backHref="/people"
      breadcrumbLabel="People"
      title={fullName}
      subtitle={subtitle}
      prevUrl={adjacentPeople?.prevLead ? `/people/${adjacentPeople.prevLead}` : null}
      nextUrl={adjacentPeople?.nextLead ? `/people/${adjacentPeople.nextLead}` : null}
      currentIndex={adjacentPeople?.currentIndex ?? 0}
      totalItems={adjacentPeople?.total ?? 0}
      mainContent={
        <PersonProfileTabs
          personId={person.id}
          personName={fullName}
          personProfile={person.personProfile}
          conversationTopics={person.conversationTopics}
          companyName={person.companyName}
          researchFit={person.researchFit}
        />
      }
      activityContent={activityContent}
      sidebarContent={sidebarContent}
    />
  );
}

/** What research concluded about the person, so the fit shows without opening the profile */
function ResearchVerdict({ fit, reason }: { fit: ResearchFit; reason: string | null }) {
  return (
    <div className="mb-6 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Research verdict
        </h3>
        <ResearchFitTag fit={fit} />
      </div>
      {reason && <p className="text-xs/relaxed text-foreground">{reason}</p>}
    </div>
  );
}

/** Why Find people picked this person, with a link to the post or page it came from */
function FoundBecause({ text, fit }: { text: string; fit: "strong" | "possible" | null }) {
  const lines = text.split("\n").map((line) => line.trim());
  const sourceLine = lines.find((line) => line.startsWith("Source: "));
  const source = sourceLine?.slice("Source: ".length);
  const unconfirmed = lines
    .find((line) => line.startsWith("Not confirmed: "))
    ?.slice("Not confirmed: ".length);
  const reason = lines
    .filter((line) => line && !line.startsWith("Source: ") && !line.startsWith("Not confirmed: "))
    .join(" ");

  return (
    <div className="mb-6 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Why they were found
        </h3>
        {fit && (
          <span
            className={
              fit === "strong"
                ? "rounded bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-400"
                : "rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-muted-foreground"
            }
          >
            {fit === "strong" ? "Strong fit" : "Worth a look"}
          </span>
        )}
      </div>
      {reason && <p className="text-xs/relaxed text-foreground">{reason}</p>}
      {unconfirmed && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Not confirmed: {unconfirmed}</p>
      )}
      {source && /^https?:\/\//.test(source) && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          <IconExternalLink className="size-3.5" />
          View source
        </a>
      )}
    </div>
  );
}
