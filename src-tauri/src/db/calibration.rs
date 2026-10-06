//! Known good/bad companies: the user's own verdicts, used to check whether
//! the fit criteria score companies the way the user would.

use rusqlite::{params, Connection, OptionalExtension, Result as SqliteResult};
use serde::Serialize;

pub const EXPECTED_FITS: [&str; 2] = ["good", "bad"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Expectation {
    pub lead_id: i64,
    pub expected_fit: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Calibration {
    pub expectations: Vec<Expectation>,
    /// When the fit criteria or About you last changed (Unix seconds). Scores
    /// from before this were made with different instructions.
    pub criteria_changed_at: i64,
}

/// Early rows were written in milliseconds and later ones in seconds
fn to_seconds(timestamp: i64) -> i64 {
    if timestamp > 100_000_000_000 {
        timestamp / 1000
    } else {
        timestamp
    }
}

pub fn set_expected_fit(conn: &Connection, lead_id: i64, fit: Option<&str>) -> SqliteResult<()> {
    conn.execute(
        "UPDATE leads SET expected_fit = ?1 WHERE id = ?2",
        params![fit, lead_id],
    )?;
    Ok(())
}

pub fn get_calibration(conn: &Connection, playbook_id: i64) -> SqliteResult<Calibration> {
    let mut stmt = conn.prepare(
        "SELECT id, expected_fit FROM leads
         WHERE playbook_id = ?1 AND expected_fit IS NOT NULL
         ORDER BY company_name ASC",
    )?;
    let expectations = stmt
        .query_map(params![playbook_id], |row| {
            Ok(Expectation {
                lead_id: row.get(0)?,
                expected_fit: row.get(1)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    let criteria_updated: Option<i64> = conn
        .query_row(
            "SELECT updated_at FROM scoring_config
             WHERE playbook_id = ?1 AND is_active = 1 ORDER BY id DESC LIMIT 1",
            params![playbook_id],
            |row| row.get(0),
        )
        .optional()?;
    let overview_updated: Option<i64> = conn
        .query_row(
            "SELECT updated_at FROM prompts
             WHERE playbook_id = ?1 AND type = 'company_overview' ORDER BY id DESC LIMIT 1",
            params![playbook_id],
            |row| row.get(0),
        )
        .optional()?;

    Ok(Calibration {
        expectations,
        criteria_changed_at: [criteria_updated, overview_updated]
            .into_iter()
            .flatten()
            .map(to_seconds)
            .max()
            .unwrap_or(0),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        active_playbook_id, create_playbook, init_schema, insert_lead, save_prompt_by_type,
        NewLead, PlaybookSource,
    };
    use crate::prompts::templates::PlaybookTemplate;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        crate::db::seed::seed_defaults(&conn).unwrap();
        conn
    }

    fn lead(conn: &Connection, name: &str, playbook: i64) -> i64 {
        let data = NewLead {
            company_name: name.to_string(),
            website: None,
            city: None,
            state: None,
            country: None,
        };
        insert_lead(conn, &data, playbook).unwrap()
    }

    #[test]
    fn expectations_are_per_playbook_and_can_be_cleared() {
        let conn = setup();
        let sales = active_playbook_id(&conn).unwrap();
        let partners = create_playbook(
            &conn,
            "Design partners",
            PlaybookSource::Template(PlaybookTemplate::DesignPartners),
        )
        .unwrap();
        let acme = lead(&conn, "Acme", sales);
        let birch = lead(&conn, "Birch", partners);

        set_expected_fit(&conn, acme, Some("good")).unwrap();
        set_expected_fit(&conn, birch, Some("bad")).unwrap();

        let sales_check = get_calibration(&conn, sales).unwrap();
        assert_eq!(sales_check.expectations.len(), 1);
        assert_eq!(sales_check.expectations[0].lead_id, acme);
        assert_eq!(sales_check.expectations[0].expected_fit, "good");

        set_expected_fit(&conn, acme, None).unwrap();
        assert!(get_calibration(&conn, sales)
            .unwrap()
            .expectations
            .is_empty());
    }

    #[test]
    fn changed_at_uses_seconds_even_for_millisecond_seed_rows() {
        let conn = setup();
        let sales = active_playbook_id(&conn).unwrap();
        // The seeded criteria were written in milliseconds
        let changed = get_calibration(&conn, sales).unwrap().criteria_changed_at;
        let now = chrono::Utc::now().timestamp();
        assert!(
            (now - 60..=now + 60).contains(&changed),
            "{changed} is not seconds"
        );

        // Saving About you later moves the change time forward
        save_prompt_by_type(&conn, sales, "company_overview", "We build Mamabird").unwrap();
        assert!(get_calibration(&conn, sales).unwrap().criteria_changed_at >= changed);
    }
}
