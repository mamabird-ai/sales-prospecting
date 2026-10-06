use crate::db::{self, DbState, PeopleSearch};
use tauri::State;

/// Record a Find people search in the active playbook. The returned id goes to
/// each of the search's jobs, so the people they find count toward it.
#[tauri::command]
pub fn create_people_search(
    state: State<'_, DbState>,
    description: String,
    size: String,
) -> Result<i64, String> {
    let description = description.trim();
    if description.is_empty() {
        return Err("Describe who you're looking for".to_string());
    }
    if !matches!(size.as_str(), "standard" | "wide") {
        return Err(format!("Unknown search size: {size}"));
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let playbook_id = db::active_playbook_id(&conn).map_err(|e| e.to_string())?;
    db::create_people_search(&conn, playbook_id, description, &size).map_err(|e| e.to_string())
}

/// Forget a search whose jobs couldn't start
#[tauri::command]
pub fn delete_people_search(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_people_search(&conn, id).map_err(|e| e.to_string())
}

/// Past searches in the active playbook, newest first
#[tauri::command]
pub fn get_people_searches(state: State<'_, DbState>) -> Result<Vec<PeopleSearch>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let playbook_id = db::active_playbook_id(&conn).map_err(|e| e.to_string())?;
    db::list_people_searches(&conn, playbook_id).map_err(|e| e.to_string())
}
