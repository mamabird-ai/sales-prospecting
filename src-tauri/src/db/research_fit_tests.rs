//! Tests for how a research verdict lands on a person

use crate::db::{enrich_person, get_person_raw, init_schema, normalize_research_fit};
use crate::jobs::enrichment::PersonEnrichment;
use rusqlite::Connection;

fn person(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO people (first_name, last_name, created_at, playbook_id) VALUES ('A', 'B', 0, 1)",
        [],
    )
    .unwrap();
    conn.last_insert_rowid()
}

#[test]
fn verdict_phrasings_map_to_three_values() {
    assert_eq!(normalize_research_fit("strong"), Some("strong"));
    assert_eq!(normalize_research_fit("Strong fit"), Some("strong"));
    assert_eq!(normalize_research_fit("possible fit"), Some("possible"));
    assert_eq!(normalize_research_fit("Unlikely"), Some("unlikely"));
    assert_eq!(normalize_research_fit("not a fit"), Some("unlikely"));
    assert_eq!(normalize_research_fit("no"), Some("unlikely"));
    assert_eq!(normalize_research_fit(""), None);
    assert_eq!(normalize_research_fit("banana"), None);
}

#[test]
fn each_research_run_replaces_the_verdict_but_keeps_contact_details() {
    let conn = Connection::open_in_memory().unwrap();
    init_schema(&conn).unwrap();
    let id = person(&conn);

    enrich_person(
        &&conn,
        id,
        &PersonEnrichment {
            email: Some("a@b.com".into()),
            fit: Some("Strong fit".into()),
            fit_reason: Some(" Runs a beta. ".into()),
            ..Default::default()
        },
    )
    .unwrap();
    let p = get_person_raw(&conn, id).unwrap().unwrap();
    assert_eq!(p.research_fit.as_deref(), Some("strong"));
    assert_eq!(p.research_fit_reason.as_deref(), Some("Runs a beta."));

    // A later run with a different email keeps the first, but the verdict moves
    enrich_person(
        &&conn,
        id,
        &PersonEnrichment {
            email: Some("other@b.com".into()),
            fit: Some("unlikely".into()),
            fit_reason: None,
            ..Default::default()
        },
    )
    .unwrap();
    let p = get_person_raw(&conn, id).unwrap().unwrap();
    assert_eq!(p.email.as_deref(), Some("a@b.com"));
    assert_eq!(p.research_fit.as_deref(), Some("unlikely"));
    assert_eq!(p.research_fit_reason, None);

    // No verdict in the output leaves the last one alone
    enrich_person(&&conn, id, &PersonEnrichment::default()).unwrap();
    let p = get_person_raw(&conn, id).unwrap().unwrap();
    assert_eq!(p.research_fit.as_deref(), Some("unlikely"));
}
