use crate::db::{self, DbState, PlaybookSource, PlaybooksState, TierLabels};
use crate::prompts::templates::PlaybookTemplate;
use tauri::State;

const MAX_NAME_LENGTH: usize = 60;

fn clean_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Give the playbook a name".to_string());
    }
    Ok(name.chars().take(MAX_NAME_LENGTH).collect())
}

fn state_of(conn: &rusqlite::Connection) -> Result<PlaybooksState, String> {
    Ok(PlaybooksState {
        playbooks: db::list_playbooks(conn).map_err(|e| e.to_string())?,
        active_id: db::active_playbook_id(conn).map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
pub fn get_playbooks(state: State<'_, DbState>) -> Result<PlaybooksState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    state_of(&conn)
}

/// Create a playbook and switch to it. `source` is a template id ("sales",
/// "design_partners") or "copy" to copy the active playbook's setup.
#[tauri::command]
pub fn create_playbook(
    state: State<'_, DbState>,
    name: String,
    source: String,
) -> Result<PlaybooksState, String> {
    let name = clean_name(&name)?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let source = if source == "copy" {
        PlaybookSource::Copy(db::active_playbook_id(&conn).map_err(|e| e.to_string())?)
    } else {
        PlaybookSource::Template(
            PlaybookTemplate::from_id(&source)
                .ok_or_else(|| format!("Unknown playbook template: {source}"))?,
        )
    };
    let id = db::create_playbook(&conn, &name, source).map_err(|e| e.to_string())?;
    db::set_active_playbook(&conn, id).map_err(|e| e.to_string())?;
    state_of(&conn)
}

#[tauri::command]
pub fn rename_playbook(
    state: State<'_, DbState>,
    id: i64,
    name: String,
) -> Result<PlaybooksState, String> {
    let name = clean_name(&name)?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::rename_playbook(&conn, id, &name).map_err(|e| e.to_string())?;
    state_of(&conn)
}

#[tauri::command]
pub fn update_tier_labels(
    state: State<'_, DbState>,
    id: i64,
    labels: TierLabels,
) -> Result<PlaybooksState, String> {
    let defaults = TierLabels::default();
    // An empty label falls back to the default rather than showing nothing
    let pick = |value: &str, fallback: String| {
        let value = value.trim();
        if value.is_empty() {
            fallback
        } else {
            value.chars().take(30).collect()
        }
    };
    let labels = TierLabels {
        hot: pick(&labels.hot, defaults.hot),
        warm: pick(&labels.warm, defaults.warm),
        nurture: pick(&labels.nurture, defaults.nurture),
        disqualified: pick(&labels.disqualified, defaults.disqualified),
    };
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::update_tier_labels(&conn, id, &labels).map_err(|e| e.to_string())?;
    state_of(&conn)
}

#[tauri::command]
pub fn delete_playbook(state: State<'_, DbState>, id: i64) -> Result<PlaybooksState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    if db::list_playbooks(&conn).map_err(|e| e.to_string())?.len() <= 1 {
        return Err("You need at least one playbook".to_string());
    }
    db::delete_playbook(&conn, id).map_err(|e| e.to_string())?;
    state_of(&conn)
}

#[tauri::command]
pub fn set_active_playbook(state: State<'_, DbState>, id: i64) -> Result<PlaybooksState, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::set_active_playbook(&conn, id).map_err(|e| e.to_string())?;
    state_of(&conn)
}
