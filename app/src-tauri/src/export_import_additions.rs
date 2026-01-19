// ============== EXPORT/IMPORT ADDITIONS FOR PHASE 6 ==============
// Add these commands to the lib.rs invoke_handler and the functions below

// New Structs needed:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWithStats {
    pub name: String,
    pub path: String,
    pub node_count: i32,
    pub edge_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    pub node_count: i32,
    pub edge_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub nodes_merged: i32,
    pub edges_merged: i32,
    pub nodes_skipped: i32,
    pub sessions_merged: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewNode {
    pub id: i64,
}

// ============== NEW COMMANDS ==============

#[tauri::command]
async fn export_file(app: tauri::AppHandle, filename: String, content: String) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let exports_dir = app_data.join("exports");
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    
    let filepath = exports_dir.join(&filename);
    fs::write(&filepath, content).map_err(|e| e.to_string())?;
    
    // Also try to open the folder
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .args(&["/select,", &filepath.to_string_lossy()])
        .spawn()
        .ok();
    
    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_screenshot_as(app: tauri::AppHandle, data_url: String, filename: String) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let exports_dir = app_data.join("exports");
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    
    let base64_data = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or("Invalid data URL format")?;
    
    let image_data = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;
    
    let filepath = exports_dir.join(&filename);
    fs::write(&filepath, image_data).map_err(|e| e.to_string())?;
    
    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn add_node_url(app: tauri::AppHandle, url: String, title: String) -> Result<NewNode, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    // Generate random position
    let mut rng = rand::thread_rng();
    let x: f64 = rng.gen_range(-20.0..20.0);
    let y: f64 = rng.gen_range(-15.0..15.0);
    let z: f64 = rng.gen_range(-20.0..20.0);
    
    conn.execute(
        "INSERT OR IGNORE INTO nodes (url, title, position_x, position_y, position_z, is_alive, created_at) 
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))",
        params![url, title, x, y, z]
    ).map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    
    Ok(NewNode { id })
}

#[tauri::command]
async fn add_node_with_position(
    app: tauri::AppHandle, 
    url: String, 
    title: String,
    x: f64,
    y: f64,
    z: f64,
) -> Result<NewNode, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR IGNORE INTO nodes (url, title, position_x, position_y, position_z, is_alive, created_at) 
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))",
        params![url, title, x, y, z]
    ).map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    
    Ok(NewNode { id })
}

#[tauri::command]
async fn add_edge(app: tauri::AppHandle, source_id: i64, target_id: i64) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?, ?)",
        params![source_id, target_id]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn delete_node(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    // Delete edges first
    conn.execute("DELETE FROM edges WHERE source_id = ? OR target_id = ?", params![id, id])
        .map_err(|e| e.to_string())?;
    
    // Delete node
    conn.execute("DELETE FROM nodes WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn list_sessions_with_stats(app: tauri::AppHandle) -> Result<Vec<SessionWithStats>, String> {
    let sessions_dir = get_sessions_dir(&app)?;
    let mut sessions = Vec::new();
    
    for entry in fs::read_dir(&sessions_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.extension().map_or(false, |ext| ext == "db") {
            let name = path.file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let (node_count, edge_count) = if let Ok(conn) = Connection::open(&path) {
                let nodes: i32 = conn.query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0)).unwrap_or(0);
                let edges: i32 = conn.query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0)).unwrap_or(0);
                (nodes, edges)
            } else {
                (0, 0)
            };
            
            sessions.push(SessionWithStats {
                name,
                path: path.to_string_lossy().to_string(),
                node_count,
                edge_count,
            });
        }
    }
    
    Ok(sessions)
}

#[tauri::command]
async fn get_session_stats(path: String) -> Result<SessionStats, String> {
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open database: {}", e))?;
    
    let node_count: i32 = conn.query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let edge_count: i32 = conn.query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    
    Ok(SessionStats { node_count, edge_count })
}

#[tauri::command]
async fn merge_sessions(app: tauri::AppHandle, session_paths: Vec<String>) -> Result<MergeResult, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let main_db_path = app_data.join("void.db");
    
    let main_conn = Connection::open(&main_db_path).map_err(|e| e.to_string())?;
    
    let mut result = MergeResult {
        nodes_merged: 0,
        edges_merged: 0,
        nodes_skipped: 0,
        sessions_merged: 0,
    };
    
    // Get existing URLs
    let mut existing_urls: HashMap<String, i64> = HashMap::new();
    {
        let mut stmt = main_conn.prepare("SELECT id, url FROM nodes").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| e.to_string())?;
        
        for row in rows {
            if let Ok((id, url)) = row {
                existing_urls.insert(url.to_lowercase(), id);
            }
        }
    }
    
    for session_path in session_paths {
        let session_conn = match Connection::open(&session_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        
        // Map old IDs to new IDs
        let mut id_map: HashMap<i64, i64> = HashMap::new();
        
        // Import nodes
        let mut stmt = match session_conn.prepare(
            "SELECT id, url, title, favicon, screenshot, position_x, position_y, position_z, is_alive, last_crawled FROM nodes"
        ) {
            Ok(s) => s,
            Err(_) => continue,
        };
        
        let nodes = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, f64>(7)?,
                row.get::<_, i32>(8)?,
                row.get::<_, Option<String>>(9)?,
            ))
        }).map_err(|e| e.to_string())?;
        
        for node_result in nodes {
            let (old_id, url, title, favicon, screenshot, x, y, z, is_alive, last_crawled) = match node_result {
                Ok(n) => n,
                Err(_) => continue,
            };
            
            let url_lower = url.to_lowercase();
            
            if let Some(&existing_id) = existing_urls.get(&url_lower) {
                id_map.insert(old_id, existing_id);
                result.nodes_skipped += 1;
                continue;
            }
            
            let insert_result = main_conn.execute(
                "INSERT INTO nodes (url, title, favicon, screenshot, position_x, position_y, position_z, is_alive, last_crawled, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
                params![url, title, favicon, screenshot, x, y, z, is_alive, last_crawled]
            );
            
            if let Ok(_) = insert_result {
                let new_id = main_conn.last_insert_rowid();
                id_map.insert(old_id, new_id);
                existing_urls.insert(url_lower, new_id);
                result.nodes_merged += 1;
            }
        }
        
        // Import edges
        let mut stmt = match session_conn.prepare("SELECT source_id, target_id FROM edges") {
            Ok(s) => s,
            Err(_) => continue,
        };
        
        let edges = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())?;
        
        for edge_result in edges {
            let (old_source, old_target) = match edge_result {
                Ok(e) => e,
                Err(_) => continue,
            };
            
            if let (Some(&new_source), Some(&new_target)) = (id_map.get(&old_source), id_map.get(&old_target)) {
                let insert_result = main_conn.execute(
                    "INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?, ?)",
                    params![new_source, new_target]
                );
                
                if let Ok(count) = insert_result {
                    if count > 0 {
                        result.edges_merged += 1;
                    }
                }
            }
        }
        
        result.sessions_merged += 1;
    }
    
    Ok(result)
}

// ============== ADD TO invoke_handler ==============
// Add these to the tauri::generate_handler! macro:
// export_file,
// save_screenshot_as,
// add_node_url,
// add_node_with_position,
// add_edge,
// delete_node,
// list_sessions_with_stats,
// get_session_stats,
// merge_sessions,
