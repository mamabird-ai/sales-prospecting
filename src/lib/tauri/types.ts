// ============================================================================
// Lead Types
// ============================================================================

export interface Lead {
  id: number;
  companyName: string;
  website: string | null;
  industry: string | null;
  subIndustry: string | null;
  employees: number | null;
  employeeRange: string | null;
  revenue: number | null;
  revenueRange: string | null;
  companyLinkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  researchStatus: "pending" | "in_progress" | "completed" | "failed";
  researchedAt: number | null;
  userStatus: string;
  createdAt: number;
  companyProfile: string | null;
  notes: string | null;
}

export interface NewLead {
  companyName: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
}

// ============================================================================
// Person Types
// ============================================================================

/** How research judged a person: a clear fit, worth considering, or probably not */
export type ResearchFit = "strong" | "possible" | "unlikely";

export interface Person {
  id: number;
  leadId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  managementLevel: string | null;
  linkedinUrl: string | null;
  yearJoined: number | null;
  personProfile: string | null;
  researchStatus: "pending" | "in_progress" | "completed" | "failed";
  researchedAt: number | null;
  userStatus: string;
  conversationTopics: string | null;
  conversationGeneratedAt: number | null;
  createdAt: number;
  /** Why Find people picked this person, with "Source: <url>" on its own line */
  foundBecause: string | null;
  /** How well Find people thinks they match */
  foundFit: "strong" | "possible" | null;
  /** Research's verdict after reading about them, replaced by each research run */
  researchFit: ResearchFit | null;
  researchFitReason: string | null;
}

export interface PersonWithCompany extends Person {
  companyName: string | null;
  companyWebsite: string | null;
  companyIndustry: string | null;
}

export interface NewPerson {
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  linkedinUrl?: string;
  leadId?: number;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface Prompt {
  id: number;
  type: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type PromptType = "company" | "person" | "company_overview" | "conversation_topics";

// ============================================================================
// Scoring Types
// ============================================================================

export type ScoringTier = "hot" | "warm" | "nurture" | "disqualified";

export interface RequiredCharacteristic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface DemandSignifier {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
}

interface RequirementResult {
  id: string;
  name: string;
  passed: boolean;
  reason: string;
}

interface SignifierScore {
  id: string;
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  reason: string;
}

export interface ScoringConfig {
  id: number;
  name: string;
  isActive: boolean;
  requiredCharacteristics: RequiredCharacteristic[];
  demandSignifiers: DemandSignifier[];
  tierHotMin: number;
  tierWarmMin: number;
  tierNurtureMin: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeadScore {
  id: number;
  leadId: number;
  configId: number;
  passesRequirements: boolean;
  requirementResults: RequirementResult[];
  totalScore: number;
  scoreBreakdown: SignifierScore[];
  tier: ScoringTier;
  scoringNotes: string | null;
  scoredAt: number | null;
  createdAt: number;
}

export interface LeadWithScore {
  id: number;
  companyName: string;
  website: string | null;
  industry: string | null;
  subIndustry: string | null;
  employees: number | null;
  employeeRange: string | null;
  revenue: number | null;
  revenueRange: string | null;
  companyLinkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  researchStatus: "pending" | "in_progress" | "completed" | "failed";
  researchedAt: number | null;
  userStatus: string;
  createdAt: number;
  companyProfile: string | null;
  notes: string | null;
  score: LeadScore | null;
}

// ============================================================================
// People Searches
// ============================================================================

export type PeopleSearchSize = "standard" | "wide";

/** A past Find people search and what it turned up */
export interface PeopleSearch {
  id: number;
  description: string;
  size: PeopleSearchSize;
  createdAt: number;
  /** People this search added to the playbook */
  peopleFound: number;
  /** Of those, how many Find people marked as a strong fit */
  strongFits: number;
  /** Of those, how many you've moved past "New" */
  peopleActedOn: number;
}

// ============================================================================
// Research Types
// ============================================================================

export interface StreamEvent {
  jobId: string;
  eventType: string;
  content: string;
  timestamp: number;
}

export interface ResearchResult {
  jobId: string;
  status: string;
}

// ============================================================================
// Navigation Types
// ============================================================================

export interface AdjacentResult {
  prevLead: number | null;
  nextLead: number | null;
  currentIndex: number;
  total: number;
}

// ============================================================================
// Onboarding Types
// ============================================================================

export interface OnboardingStatus {
  hasCompanyOverview: boolean;
  hasLead: boolean;
  hasResearchedLead: boolean;
  hasScoredLead: boolean;
  hasResearchedPerson: boolean;
  hasConversationTopics: boolean;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobType =
  | "company_research"
  | "person_research"
  | "scoring"
  | "conversation"
  | "lead_finder"
  | "people_finder";
export type JobStatus = "queued" | "running" | "completed" | "error" | "timeout" | "cancelled";

export interface Job {
  id: string;
  jobType: JobType;
  entityId: number;
  entityLabel: string;
  status: JobStatus;
  prompt: string;
  model: string | null;
  workingDir: string;
  outputPath: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  pid: number | null;
  claudeSessionId: string | null;
  claudeModel: string | null;
  lastEventIndex: number;
  // Stream statistics
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  totalStdoutBytes: number;
  totalStderrBytes: number;
  completionState: string | null;
}

export interface JobLog {
  id: number;
  jobId: string;
  logType: string;
  content: string;
  toolName: string | null;
  timestamp: number;
  sequence: number;
  source: "stdout" | "stderr" | "internal";
}

// ============================================================================
// Playbook Types
// ============================================================================

/** Display names for the scoring tiers; stored tier values never change */
export type TierLabels = Record<ScoringTier, string>;

export interface Playbook {
  id: number;
  name: string;
  tierLabels: TierLabels;
  leadCount: number;
  personCount: number;
  createdAt: number;
}

export interface PlaybooksState {
  playbooks: Playbook[];
  activeId: number;
}

/** Where a new playbook's instructions and fit criteria come from */
export type PlaybookSource = "design_partners" | "sales" | "copy";

// ============================================================================
// Known good/bad companies
// ============================================================================

export interface Calibration {
  expectations: { leadId: number; expectedFit: "good" | "bad" }[];
  /** When the fit criteria or company profile last changed (Unix seconds) */
  criteriaChangedAt: number;
}
