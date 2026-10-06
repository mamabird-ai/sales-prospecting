//! Built-in starting points for new playbooks

use crate::db::schema::TierLabels;
use crate::prompts::defaults;
use serde::Deserialize;

/// Prompts and criteria for finding design partners who give product feedback
mod design_partners {
    pub const COMPANY_OVERVIEW: &str =
        include_str!("templates/design_partners/company_overview.md");
    pub const COMPANY: &str = include_str!("templates/design_partners/company.md");
    pub const PERSON: &str = include_str!("templates/design_partners/person.md");
    pub const CONVERSATION_TOPICS: &str =
        include_str!("templates/design_partners/conversation_topics.md");
    pub const SCORING: &str = include_str!("templates/design_partners/scoring.json");
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PlaybookTemplate {
    Sales,
    DesignPartners,
}

/// Fit criteria in the shape stored in the scoring_config table
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FitCriteria {
    pub required_characteristics: serde_json::Value,
    pub demand_signifiers: serde_json::Value,
    pub tier_hot_min: i64,
    pub tier_warm_min: i64,
    pub tier_nurture_min: i64,
}

impl PlaybookTemplate {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "sales" => Some(Self::Sales),
            "design_partners" => Some(Self::DesignPartners),
            _ => None,
        }
    }

    /// (prompt type, content) pairs to create. Sales has no overview, so the
    /// app asks the user to describe their company.
    pub fn prompts(&self) -> Vec<(&'static str, &'static str)> {
        match self {
            Self::Sales => vec![
                ("company", defaults::COMPANY),
                ("person", defaults::PERSON),
                ("conversation_topics", defaults::CONVERSATION_TOPICS),
            ],
            Self::DesignPartners => vec![
                ("company_overview", design_partners::COMPANY_OVERVIEW),
                ("company", design_partners::COMPANY),
                ("person", design_partners::PERSON),
                ("conversation_topics", design_partners::CONVERSATION_TOPICS),
            ],
        }
    }

    pub fn criteria(&self) -> FitCriteria {
        match self {
            Self::Sales => {
                let (required_characteristics, demand_signifiers) =
                    crate::db::seed::default_fit_criteria();
                FitCriteria {
                    required_characteristics,
                    demand_signifiers,
                    tier_hot_min: 80,
                    tier_warm_min: 50,
                    tier_nurture_min: 30,
                }
            }
            Self::DesignPartners => serde_json::from_str(design_partners::SCORING)
                .expect("embedded design partner scoring template must be valid"),
        }
    }

    pub fn tier_labels(&self) -> TierLabels {
        match self {
            Self::Sales => TierLabels::default(),
            Self::DesignPartners => TierLabels {
                hot: "Strong fit".to_string(),
                warm: "Possible fit".to_string(),
                nurture: "Maybe later".to_string(),
                disqualified: "Not a fit".to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PlaybookTemplate;

    #[test]
    fn templates_parse_and_have_every_research_prompt() {
        for template in [PlaybookTemplate::Sales, PlaybookTemplate::DesignPartners] {
            let criteria = template.criteria();
            assert!(criteria
                .required_characteristics
                .as_array()
                .is_some_and(|a| !a.is_empty()));
            assert!(criteria
                .demand_signifiers
                .as_array()
                .is_some_and(|a| !a.is_empty()));
            let types: Vec<_> = template.prompts().iter().map(|(t, _)| *t).collect();
            for required in ["company", "person", "conversation_topics"] {
                assert!(
                    types.contains(&required),
                    "{template:?} is missing {required}"
                );
            }
        }
    }
}
