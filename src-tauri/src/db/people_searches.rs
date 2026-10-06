use crate::db::schema::PeopleSearch;
use rusqlite::{params, Connection, Result as SqliteResult};

/// Most past searches to show; older ones stay in the table
const MAX_LISTED: i64 = 20;

/// Record a search before its jobs start, so the people they find can be tied to it
pub fn create_people_search(
    conn: &Connection,
    playbook_id: i64,
    description: &str,
    size: &str,
) -> SqliteResult<i64> {
    conn.execute(
        "INSERT INTO people_searches (playbook_id, description, size, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            playbook_id,
            description,
            size,
            chrono::Utc::now().timestamp()
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Forget a search whose jobs never started. People keep their search_id,
/// so a search that did run can't be removed from under them.
pub fn delete_people_search(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM people_searches
         WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM people WHERE search_id = ?1)",
        params![id],
    )?;
    Ok(())
}

/// Past searches in a playbook, newest first, each with what it turned up
pub fn list_people_searches(conn: &Connection, playbook_id: i64) -> SqliteResult<Vec<PeopleSearch>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.description, s.size, s.created_at,
                (SELECT COUNT(*) FROM people WHERE search_id = s.id),
                (SELECT COUNT(*) FROM people WHERE search_id = s.id AND found_fit = 'strong'),
                (SELECT COUNT(*) FROM people WHERE search_id = s.id AND user_status != 'new')
         FROM people_searches s
         WHERE s.playbook_id = ?1
         ORDER BY s.created_at DESC, s.id DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![playbook_id, MAX_LISTED], |row| {
        Ok(PeopleSearch {
            id: row.get(0)?,
            description: row.get(1)?,
            size: row.get(2)?,
            created_at: row.get(3)?,
            people_found: row.get(4)?,
            strong_fits: row.get(5)?,
            people_acted_on: row.get(6)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_schema;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn
    }

    fn add_person(conn: &Connection, search_id: i64, fit: &str, status: &str) {
        conn.execute(
            "INSERT INTO people (first_name, last_name, created_at, playbook_id, found_fit, user_status, search_id)
             VALUES ('A', 'B', 0, 1, ?1, ?2, ?3)",
            params![fit, status, search_id],
        )
        .unwrap();
    }

    #[test]
    fn searches_list_newest_first_with_their_outcome() {
        let conn = setup();
        let first = create_people_search(&conn, 1, "PMs who post about betas", "standard").unwrap();
        let second = create_people_search(&conn, 1, "Founders running betas", "wide").unwrap();
        // Same second; the newer id wins the tie
        add_person(&conn, first, "strong", "new");
        add_person(&conn, first, "possible", "reached_out");
        add_person(&conn, second, "strong", "new");

        let searches = list_people_searches(&conn, 1).unwrap();
        assert_eq!(
            searches.iter().map(|s| s.id).collect::<Vec<_>>(),
            vec![second, first]
        );
        let older = &searches[1];
        assert_eq!(older.description, "PMs who post about betas");
        assert_eq!(older.size, "standard");
        assert_eq!(
            (older.people_found, older.strong_fits, older.people_acted_on),
            (2, 1, 1)
        );
        assert_eq!(searches[0].people_found, 1);
    }

    #[test]
    fn searches_belong_to_their_playbook() {
        let conn = setup();
        create_people_search(&conn, 1, "In playbook one", "standard").unwrap();
        create_people_search(&conn, 2, "In playbook two", "standard").unwrap();
        let names: Vec<String> = list_people_searches(&conn, 2)
            .unwrap()
            .into_iter()
            .map(|s| s.description)
            .collect();
        assert_eq!(names, vec!["In playbook two"]);
    }

    #[test]
    fn only_a_search_without_people_can_be_deleted() {
        let conn = setup();
        let never_ran = create_people_search(&conn, 1, "x", "standard").unwrap();
        let ran = create_people_search(&conn, 1, "y", "standard").unwrap();
        add_person(&conn, ran, "strong", "new");

        delete_people_search(&conn, never_ran).unwrap();
        delete_people_search(&conn, ran).unwrap();

        let ids: Vec<i64> = list_people_searches(&conn, 1).unwrap().iter().map(|s| s.id).collect();
        assert_eq!(ids, vec![ran]);
    }
}
