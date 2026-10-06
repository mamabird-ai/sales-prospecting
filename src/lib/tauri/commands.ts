import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  Lead,
  NewLead,
  Person,
  PersonWithCompany,
  NewPerson,
  Prompt,
  PromptType,
  ScoringConfig,
  LeadScore,
  LeadWithScore,
  StreamEvent,
  ResearchResult,
  AdjacentResult,
  OnboardingStatus,
  Job,
  JobLog,
  PlaybooksState,
  PlaybookSource,
  TierLabels,
  Calibration,
  PeopleSearch,
  PeopleSearchSize,
} from "./types";

// ============================================================================
// Lead Commands
// ============================================================================

export async function getLead(id: number): Promise<Lead | null> {
  return invoke("get_lead", { id });
}

export async function getAllLeads(): Promise<Lead[]> {
  return invoke("get_all_leads");
}

export async function getAdjacentLeads(currentId: number): Promise<AdjacentResult> {
  return invoke("get_adjacent_leads", { currentId });
}

export async function insertLead(data: NewLead): Promise<number> {
  return invoke("insert_lead", { data });
}

export async function updateLeadUserStatus(leadId: number, status: string): Promise<void> {
  return invoke("update_lead_user_status", { leadId, status });
}

export async function updateLeadNotes(leadId: number, notes: string): Promise<void> {
  return invoke("update_lead_notes", { leadId, notes });
}

export async function deleteLeads(leadIds: number[]): Promise<number> {
  return invoke("delete_leads", { leadIds });
}

// ============================================================================
// Person Commands
// ============================================================================

export async function getPerson(id: number): Promise<PersonWithCompany | null> {
  return invoke("get_person", { id });
}

export async function getPeopleForLead(leadId: number): Promise<Person[]> {
  return invoke("get_people_for_lead", { leadId });
}

export async function getAllPeople(): Promise<PersonWithCompany[]> {
  return invoke("get_all_people");
}

export async function getAdjacentPeople(currentId: number): Promise<AdjacentResult> {
  return invoke("get_adjacent_people", { currentId });
}

export async function insertPerson(data: NewPerson): Promise<number> {
  return invoke("insert_person", { data });
}

export async function updatePersonUserStatus(personId: number, status: string): Promise<void> {
  return invoke("update_person_user_status", { personId, status });
}

export async function deletePeople(personIds: number[]): Promise<number> {
  return invoke("delete_people", { personIds });
}

// ============================================================================
// Prompt Commands
// ============================================================================

export async function getPromptByType(promptType: PromptType): Promise<Prompt | null> {
  return invoke("get_prompt_by_type", { promptType });
}

export async function savePromptByType(promptType: PromptType, content: string): Promise<number> {
  return invoke("save_prompt_by_type", { promptType, content });
}

// ============================================================================
// Company Overview Commands
// ============================================================================

export async function saveCompanyOverview(content: string): Promise<number> {
  return savePromptByType("company_overview", content);
}

// ============================================================================
// Onboarding Commands
// ============================================================================

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return invoke("get_onboarding_status");
}

// ============================================================================
// Scoring Config Commands
// ============================================================================

export async function getActiveScoringConfig(): Promise<ScoringConfig | null> {
  return invoke("get_active_scoring_config");
}

export async function saveScoringConfig(
  name: string,
  requiredCharacteristics: string,
  demandSignifiers: string,
  tierHotMin: number,
  tierWarmMin: number,
  tierNurtureMin: number,
  id?: number
): Promise<number> {
  return invoke("save_scoring_config", {
    name,
    requiredCharacteristics,
    demandSignifiers,
    tierHotMin,
    tierWarmMin,
    tierNurtureMin,
    id,
  });
}

// ============================================================================
// Lead Score Commands
// ============================================================================

export async function getLeadScore(leadId: number): Promise<LeadScore | null> {
  return invoke("get_lead_score", { leadId });
}

export async function getLeadsWithScores(): Promise<LeadWithScore[]> {
  return invoke("get_leads_with_scores");
}

// ============================================================================
// Research Commands
// ============================================================================

export async function startResearch(
  leadId: number,
  onEvent: (event: StreamEvent) => void,
  customPrompt?: string
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_research", {
    leadId,
    customPrompt,
    onEvent: channel,
  });
}

export async function startPersonResearch(
  personId: number,
  onEvent: (event: StreamEvent) => void,
  customPrompt?: string
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_person_research", {
    personId,
    customPrompt,
    onEvent: channel,
  });
}

/** Where a Find people search concentrates; a wide search runs all three */
export type SearchFocus = "linkedin" | "talks" | "startups";

export async function startFindPeople(
  description: string,
  onEvent: (event: StreamEvent) => void,
  focus?: SearchFocus,
  searchId?: number
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_find_people", {
    description,
    focus: focus ?? null,
    searchId: searchId ?? null,
    onEvent: channel,
  });
}

/** Record a Find people search so the people its jobs find count toward it */
export async function createPeopleSearch(
  description: string,
  size: PeopleSearchSize
): Promise<number> {
  return invoke("create_people_search", { description, size });
}

/** Forget a search whose jobs couldn't start */
export async function deletePeopleSearch(id: number): Promise<void> {
  return invoke("delete_people_search", { id });
}

/** Past searches in the active playbook, newest first */
export async function getPeopleSearches(): Promise<PeopleSearch[]> {
  return invoke("get_people_searches");
}

export async function startFindLeads(
  icpDescription: string,
  onEvent: (event: StreamEvent) => void
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_find_leads", {
    icpDescription,
    onEvent: channel,
  });
}

export async function killJob(jobId: string): Promise<void> {
  return invoke("kill_job", { jobId });
}

// ============================================================================
// Scoring Commands
// ============================================================================

export async function startScoring(
  leadId: number,
  onEvent: (event: StreamEvent) => void
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_scoring", {
    leadId,
    onEvent: channel,
  });
}

// ============================================================================
// Conversation Generation Commands
// ============================================================================

/** "not_a_fit" writes for someone research judged unlikely: a smaller, honest ask */
export type MessageMode = "not_a_fit";

export async function startConversationGeneration(
  personId: number,
  onEvent: (event: StreamEvent) => void,
  mode?: MessageMode
): Promise<ResearchResult> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;

  return invoke("start_conversation_generation", {
    personId,
    mode: mode ?? null,
    onEvent: channel,
  });
}

// ============================================================================
// Job Commands
// ============================================================================

export async function getJobsActive(): Promise<Job[]> {
  return invoke("get_jobs_active");
}

export async function getJobsRecent(limit?: number): Promise<Job[]> {
  return invoke("get_jobs_recent", { limit });
}

export async function getJobById(jobId: string): Promise<Job | null> {
  return invoke("get_job_by_id", { jobId });
}

export async function getJobLogs(
  jobId: string,
  afterSequence?: number,
  limit?: number
): Promise<JobLog[]> {
  return invoke("get_job_logs_cmd", { jobId, afterSequence, limit });
}

export async function deleteJob(jobId: string): Promise<void> {
  return invoke("delete_job_cmd", { jobId });
}

// ============================================================================
// Settings Commands
// ============================================================================

export interface Settings {
  model: string;
  useChrome: boolean;
  updatedAt: number;
}

export async function getSettings(): Promise<Settings> {
  return invoke("get_settings");
}

export async function updateSettings(model: string, useChrome: boolean): Promise<void> {
  return invoke("update_settings", { model, useChrome });
}

// ============================================================================
// Playbook Commands
// ============================================================================

export async function getPlaybooks(): Promise<PlaybooksState> {
  return invoke("get_playbooks");
}

export async function createPlaybook(
  name: string,
  source: PlaybookSource
): Promise<PlaybooksState> {
  return invoke("create_playbook", { name, source });
}

export async function renamePlaybook(id: number, name: string): Promise<PlaybooksState> {
  return invoke("rename_playbook", { id, name });
}

export async function updateTierLabels(id: number, labels: TierLabels): Promise<PlaybooksState> {
  return invoke("update_tier_labels", { id, labels });
}

export async function deletePlaybook(id: number): Promise<PlaybooksState> {
  return invoke("delete_playbook", { id });
}

export async function setActivePlaybook(id: number): Promise<PlaybooksState> {
  return invoke("set_active_playbook", { id });
}

// ============================================================================
// Known good/bad companies
// ============================================================================

export async function getCalibration(): Promise<Calibration> {
  return invoke("get_calibration");
}

export async function setLeadExpectedFit(
  leadId: number,
  expectedFit: "good" | "bad" | null
): Promise<void> {
  return invoke("set_lead_expected_fit", { leadId, expectedFit });
}

// ============================================================================
// Company profile
// ============================================================================

export interface CompanyDraft {
  companyName: string | null;
  product: string | null;
  problem: string | null;
  customer: string | null;
  notAFit: string | null;
  stage: string | null;
}

/** Have Claude read a website and draft the company profile fields */
export async function draftCompanyProfile(website: string): Promise<CompanyDraft> {
  return invoke("draft_company_profile", { website });
}
