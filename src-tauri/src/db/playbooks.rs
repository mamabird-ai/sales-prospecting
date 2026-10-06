use crate::db::schema::{Playbook, TierLabels};
use crate::prompts::templates::PlaybookTemplate;
use rusqlite::{params, Connection, OptionalExtension, Result as SqliteResult};

fn tier_labels_from_json(json: Option<String>) -> TierLabels {
    json.and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn list_playbooks(conn: &Connection) -> SqliteResult<Vec<Playbook>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.tier_labels, p.created_at,
                (SELECT COUNT(*) FROM leads WHERE playbook_id = p.id),
                (SELECT COUNT(*) FROM people WHERE playbook_id = p.id)
         FROM playbooks p ORDER BY p.created_at ASC, p.id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Playbook {
            id: row.get(0)?,
            name: row.get(1)?,
            tier_labels: tier_labels_from_json(row.get(2)?),
            created_at: row.get(3)?,
            lead_count: row.get(4)?,
            person_count: row.get(5)?,
        })
    })?;
    rows.collect()
}

fn playbook_exists(conn: &Connection, id: i64) -> SqliteResult<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM playbooks WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )
}

/// The playbook the user is working in. Falls back to the oldest playbook if
/// the stored one no longer exists.
pub fn active_playbook_id(conn: &Connection) -> SqliteResult<i64> {
    let stored: i64 = conn.query_row(
        "SELECT active_playbook_id FROM settings WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    if playbook_exists(conn, stored)? {
        return Ok(stored);
    }
    let fallback: i64 = conn.query_row("SELECT MIN(id) FROM playbooks", [], |row| row.get(0))?;
    set_active_playbook(conn, fallback)?;
    Ok(fallback)
}

pub fn set_active_playbook(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "UPDATE settings SET active_playbook_id = ?1 WHERE id = 1",
        params![id],
    )?;
    Ok(())
}

pub fn lead_playbook_id(conn: &Connection, lead_id: i64) -> SqliteResult<i64> {
    conn.query_row(
        "SELECT playbook_id FROM leads WHERE id = ?1",
        params![lead_id],
        |row| row.get(0),
    )
}

pub fn person_playbook_id(conn: &Connection, person_id: i64) -> SqliteResult<i64> {
    conn.query_row(
        "SELECT playbook_id FROM people WHERE id = ?1",
        params![person_id],
        |row| row.get(0),
    )
}

/// Where a new playbook's prompts and fit criteria come from
pub enum PlaybookSource {
    Template(PlaybookTemplate),
    /// Copy the instructions and criteria (not the companies or people) of another playbook
    Copy(i64),
}

/// Create a playbook with its prompts and fit criteria, returning its id
pub fn create_playbook(conn: &Connection, name: &str, source: PlaybookSource) -> SqliteResult<i64> {
    let now = chrono::Utc::now().timestamp();
    let tx = conn.unchecked_transaction()?;

    let tier_labels = match &source {
        PlaybookSource::Template(template) => template.tier_labels(),
        PlaybookSource::Copy(from) => tier_labels_from_json(
            tx.query_row(
                "SELECT tier_labels FROM playbooks WHERE id = ?1",
                params![from],
                |row| row.get(0),
            )
            .optional()?
            .flatten(),
        ),
    };
    tx.execute(
        "INSERT INTO playbooks (name, tier_labels, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![
            name,
            serde_json::to_string(&tier_labels).unwrap_or_default(),
            now
        ],
    )?;
    let id = tx.last_insert_rowid();

    match source {
        PlaybookSource::Template(template) => {
            for (prompt_type, content) in template.prompts() {
                tx.execute(
                    "INSERT INTO prompts (type, content, created_at, updated_at, playbook_id)
                     VALUES (?1, ?2, ?3, ?3, ?4)",
                    params![prompt_type, content, now, id],
                )?;
            }
            let criteria = template.criteria();
            tx.execute(
                "INSERT INTO scoring_config (name, is_active, required_characteristics, demand_signifiers,
                 tier_hot_min, tier_warm_min, tier_nurture_min, created_at, updated_at, playbook_id)
                 VALUES ('default', 1, ?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)",
                params![
                    criteria.required_characteristics.to_string(),
                    criteria.demand_signifiers.to_string(),
                    criteria.tier_hot_min,
                    criteria.tier_warm_min,
                    criteria.tier_nurture_min,
                    now,
                    id
                ],
            )?;
        }
        PlaybookSource::Copy(from) => {
            // Latest prompt of each type, as get_prompt_by_type would read them
            tx.execute(
                "INSERT INTO prompts (type, content, created_at, updated_at, playbook_id)
                 SELECT type, content, ?1, ?1, ?2 FROM prompts
                 WHERE id IN (SELECT MAX(id) FROM prompts WHERE playbook_id = ?3 GROUP BY type)",
                params![now, id, from],
            )?;
            tx.execute(
                "INSERT INTO scoring_config (name, is_active, required_characteristics, demand_signifiers,
                 tier_hot_min, tier_warm_min, tier_nurture_min, created_at, updated_at, playbook_id)
                 SELECT name, 1, required_characteristics, demand_signifiers,
                        tier_hot_min, tier_warm_min, tier_nurture_min, ?1, ?1, ?2
                 FROM scoring_config WHERE playbook_id = ?3 AND is_active = 1
                 ORDER BY id DESC LIMIT 1",
                params![now, id, from],
            )?;
        }
    }

    tx.commit()?;
    Ok(id)
}

pub fn rename_playbook(conn: &Connection, id: i64, name: &str) -> SqliteResult<()> {
    conn.execute(
        "UPDATE playbooks SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, chrono::Utc::now().timestamp(), id],
    )?;
    Ok(())
}

pub fn update_tier_labels(conn: &Connection, id: i64, labels: &TierLabels) -> SqliteResult<()> {
    conn.execute(
        "UPDATE playbooks SET tier_labels = ?1, updated_at = ?2 WHERE id = ?3",
        params![
            serde_json::to_string(labels).unwrap_or_default(),
            chrono::Utc::now().timestamp(),
            id
        ],
    )?;
    Ok(())
}

/// Delete a playbook and everything in it: companies, people, scores,
/// prompts, and fit criteria. Job history is left for normal pruning.
pub fn delete_playbook(conn: &Connection, id: i64) -> SqliteResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM lead_scores WHERE lead_id IN (SELECT id FROM leads WHERE playbook_id = ?1)",
        params![id],
    )?;
    for table in ["people", "people_searches", "leads", "prompts", "scoring_config"] {
        tx.execute(
            &format!("DELETE FROM {table} WHERE playbook_id = ?1"),
            params![id],
        )?;
    }
    tx.execute("DELETE FROM playbooks WHERE id = ?1", params![id])?;
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        get_active_scoring_config, get_all_leads, get_prompt_by_type, init_schema, insert_lead,
        update_settings, NewLead,
    };

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        crate::db::seed::seed_defaults(&conn).unwrap();
        conn
    }

    fn lead(name: &str) -> NewLead {
        NewLead {
            company_name: name.to_string(),
            website: None,
            city: None,
            state: None,
            country: None,
        }
    }

    #[test]
    fn existing_data_starts_in_a_sales_playbook() {
        let conn = setup();
        let playbooks = list_playbooks(&conn).unwrap();
        assert_eq!(playbooks.len(), 1);
        assert_eq!(playbooks[0].name, "Sales prospects");
        assert_eq!(active_playbook_id(&conn).unwrap(), playbooks[0].id);
        assert!(get_prompt_by_type(&conn, playbooks[0].id, "company")
            .unwrap()
            .is_some());
    }

    #[test]
    fn playbooks_keep_separate_leads_prompts_and_criteria() {
        let conn = setup();
        let sales = active_playbook_id(&conn).unwrap();
        let partners = create_playbook(
            &conn,
            "Design partners",
            PlaybookSource::Template(PlaybookTemplate::DesignPartners),
        )
        .unwrap();

        insert_lead(&conn, &lead("Acme"), sales).unwrap();
        insert_lead(&conn, &lead("Birch"), partners).unwrap();

        let names = |id| {
            get_all_leads(&conn, id)
                .unwrap()
                .into_iter()
                .map(|l| l.company_name)
                .collect::<Vec<_>>()
        };
        assert_eq!(names(sales), vec!["Acme"]);
        assert_eq!(names(partners), vec!["Birch"]);

        let partner_prompt = get_prompt_by_type(&conn, partners, "company")
            .unwrap()
            .unwrap();
        assert!(partner_prompt.content.contains("design partner"));
        let sales_prompt = get_prompt_by_type(&conn, sales, "company")
            .unwrap()
            .unwrap();
        assert_ne!(partner_prompt.content, sales_prompt.content);

        let criteria = get_active_scoring_config(&conn, partners).unwrap().unwrap();
        assert_eq!(criteria.required_characteristics[0]["id"], "has-problem");
        assert_eq!(
            list_playbooks(&conn).unwrap()[1].tier_labels.hot,
            "Strong fit"
        );
    }

    #[test]
    fn copying_a_playbook_copies_setup_but_not_companies() {
        let conn = setup();
        let sales = active_playbook_id(&conn).unwrap();
        insert_lead(&conn, &lead("Acme"), sales).unwrap();
        crate::db::save_prompt_by_type(&conn, sales, "company_overview", "We sell widgets")
            .unwrap();

        let copy = create_playbook(&conn, "Sales EU", PlaybookSource::Copy(sales)).unwrap();

        assert!(get_all_leads(&conn, copy).unwrap().is_empty());
        assert_eq!(
            get_prompt_by_type(&conn, copy, "company_overview")
                .unwrap()
                .unwrap()
                .content,
            "We sell widgets"
        );
        assert!(get_active_scoring_config(&conn, copy).unwrap().is_some());
    }

    #[test]
    fn deleting_the_active_playbook_falls_back_to_another() {
        let conn = setup();
        let sales = active_playbook_id(&conn).unwrap();
        let partners = create_playbook(
            &conn,
            "Design partners",
            PlaybookSource::Template(PlaybookTemplate::DesignPartners),
        )
        .unwrap();
        insert_lead(&conn, &lead("Birch"), partners).unwrap();
        set_active_playbook(&conn, partners).unwrap();

        delete_playbook(&conn, partners).unwrap();

        assert_eq!(active_playbook_id(&conn).unwrap(), sales);
        assert!(get_all_leads(&conn, partners).unwrap().is_empty());
        assert!(get_prompt_by_type(&conn, partners, "company")
            .unwrap()
            .is_none());
    }

    #[test]
    fn saving_settings_keeps_the_active_playbook() {
        let conn = setup();
        let partners = create_playbook(
            &conn,
            "Design partners",
            PlaybookSource::Template(PlaybookTemplate::DesignPartners),
        )
        .unwrap();
        set_active_playbook(&conn, partners).unwrap();

        update_settings(&conn, crate::model_config::default_model(), true).unwrap();

        assert_eq!(active_playbook_id(&conn).unwrap(), partners);
    }
}
