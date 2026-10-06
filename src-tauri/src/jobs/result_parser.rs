use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// The type of job that was executed
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    CompanyResearch,
    PersonResearch,
    Scoring,
    Conversation,
    LeadFinder,
    PeopleFinder,
}

/// Metadata about a job for tracking, including output file paths
#[derive(Debug, Clone)]
pub struct JobMetadata {
    pub job_type: JobType,
    pub entity_id: i64,
    /// For CompanyResearch: company_profile.md path
    /// For PersonResearch: person_profile.md path
    /// For Scoring: score.json path
    /// For Conversation: conversation.md path
    pub primary_output_path: PathBuf,
    /// For CompanyResearch: people.json path (optional for other types)
    pub secondary_output_path: Option<PathBuf>,
    /// For CompanyResearch/PersonResearch: enrichment.json path for structured data
    pub enrichment_output_path: Option<PathBuf>,
    /// For LeadFinder and PeopleFinder: the playbook to add results to. Other job types
    /// work on an existing company or person, which already has a playbook.
    pub playbook_id: Option<i64>,
    /// For PeopleFinder: the search this job belongs to, so the people it finds
    /// show up in that search's outcome
    pub search_id: Option<i64>,
}
