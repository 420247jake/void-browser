// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use std::fs;
use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use rand::Rng;
use base64::{Engine as _, engine::general_purpose};
use rusqlite::{Connection, params};
use scraper::{Html, Selector};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoidNode {
    pub id: i64,
    pub url: String,
    pub title: String,
    pub favicon: Option<String>,
    pub screenshot: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub position_z: f64,
    pub is_alive: bool,
    pub last_crawled: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoidEdge {
    pub id: i64,
    pub source_id: i64,
    pub target_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotInfo {
    pub filename: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to the Void.", name)
}

#[tauri::command]
async fn open_site(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let label = format!("site-{}", url.replace("://", "-").replace("/", "-").replace(".", "-").chars().take(30).collect::<String>());
    
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    
    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
    // Listen for window close and emit event to main window
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            // Emit event to main window that site window was closed
            if let Some(main_window) = app_handle.get_webview_window("main") {
                let _ = main_window.emit("site-window-closed", ());
            }
        }
    });
    
    Ok(())
}

#[tauri::command]
async fn get_db_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn init_database(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_screenshots_dir(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_data.join("screenshots");
    fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
    Ok(screenshots_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_screenshot(app: tauri::AppHandle, data_url: String) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_data.join("screenshots");
    fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
    
    let base64_data = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or("Invalid data URL format")?;
    
    let image_data = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;
    
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("void-{}.png", timestamp);
    let filepath = screenshots_dir.join(&filename);
    
    fs::write(&filepath, image_data).map_err(|e| e.to_string())?;
    
    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn list_screenshots(app: tauri::AppHandle) -> Result<Vec<ScreenshotInfo>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_data.join("screenshots");
    
    if !screenshots_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut screenshots: Vec<ScreenshotInfo> = vec![];
    
    let entries = fs::read_dir(&screenshots_dir).map_err(|e| e.to_string())?;
    
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.extension().map_or(false, |ext| ext == "png") {
            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let created = metadata.created()
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                })
                .unwrap_or_else(|_| "Unknown".to_string());
            
            screenshots.push(ScreenshotInfo {
                filename,
                path: path.to_string_lossy().to_string(),
                created_at: created,
                size_bytes: metadata.len(),
            });
        }
    }
    
    screenshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(screenshots)
}

#[tauri::command]
async fn open_screenshots_folder(app: tauri::AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_data.join("screenshots");
    fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&screenshots_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&screenshots_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&screenshots_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn delete_screenshot(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportStats {
    pub nodes_imported: i32,
    pub edges_imported: i32,
    pub nodes_skipped: i32,
}

#[tauri::command]
async fn import_crawler_db(app: tauri::AppHandle, crawler_db_path: String) -> Result<ImportStats, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let app_db_path = app_data.join("void.db");
    
    let crawler_conn = Connection::open(&crawler_db_path).map_err(|e| format!("Failed to open crawler DB: {}", e))?;
    let app_conn = Connection::open(&app_db_path).map_err(|e| format!("Failed to open app DB: {}", e))?;
    
    let mut stats = ImportStats {
        nodes_imported: 0,
        edges_imported: 0,
        nodes_skipped: 0,
    };
    
    let mut id_map: HashMap<String, i64> = HashMap::new();
    
    let mut existing_urls: HashMap<String, i64> = HashMap::new();
    {
        let mut stmt = app_conn.prepare("SELECT id, url FROM nodes").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| e.to_string())?;
        
        for row in rows {
            if let Ok((id, url)) = row {
                existing_urls.insert(url, id);
            }
        }
    }
    
    let mut stmt = crawler_conn.prepare(
        "SELECT id, url, title, favicon, thumbnail, position_x, position_y, position_z, is_alive FROM nodes"
    ).map_err(|e| e.to_string())?;
    
    let crawler_nodes = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<Vec<u8>>>(4)?,
            row.get::<_, f64>(5)?,
            row.get::<_, f64>(6)?,
            row.get::<_, f64>(7)?,
            row.get::<_, i32>(8)?,
        ))
    }).map_err(|e| e.to_string())?;
    
    for node_result in crawler_nodes {
        let (crawler_id, url, title, favicon, thumbnail, x, y, z, is_alive) = node_result.map_err(|e| e.to_string())?;
        
        if let Some(&existing_id) = existing_urls.get(&url) {
            id_map.insert(crawler_id, existing_id);
            stats.nodes_skipped += 1;
            continue;
        }
        
        let screenshot: Option<String> = thumbnail.map(|data| {
            format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(&data))
        });
        
        app_conn.execute(
            "INSERT INTO nodes (url, title, favicon, screenshot, position_x, position_y, position_z, is_alive, last_crawled) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
            params![
                url,
                title.unwrap_or_else(|| "Untitled".to_string()),
                favicon,
                screenshot,
                x,
                y,
                z,
                is_alive,
            ],
        ).map_err(|e| e.to_string())?;
        
        let new_id = app_conn.last_insert_rowid();
        id_map.insert(crawler_id, new_id);
        existing_urls.insert(url.clone(), new_id);
        stats.nodes_imported += 1;
    }
    
    let mut stmt = crawler_conn.prepare(
        "SELECT source_id, target_id FROM edges WHERE target_id IS NOT NULL"
    ).map_err(|e| e.to_string())?;
    
    let crawler_edges = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
        ))
    }).map_err(|e| e.to_string())?;
    
    for edge_result in crawler_edges {
        let (source_id, target_id) = edge_result.map_err(|e| e.to_string())?;
        
        if let (Some(&app_source), Some(&app_target)) = (id_map.get(&source_id), id_map.get(&target_id)) {
            let result = app_conn.execute(
                "INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?1, ?2)",
                params![app_source, app_target],
            );
            
            if result.is_ok() {
                stats.edges_imported += 1;
            }
        }
    }
    
    Ok(stats)
}

#[tauri::command]
async fn list_crawler_dbs(directory: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&directory);
    
    if !dir.exists() {
        return Ok(vec![]);
    }
    
    let mut dbs = vec![];
    
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.extension().map_or(false, |ext| ext == "db") {
            dbs.push(path.to_string_lossy().to_string());
        }
    }
    
    Ok(dbs)
}

/// Run the crawler from the app (spawns as a subprocess)
#[tauri::command]
async fn run_crawler(
    app: tauri::AppHandle,
    url: String,
    name: String,
    max_pages: i32,
    max_depth: i32,
    screenshots: bool,
    screenshot_delay: i32,
) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or("Could not find exe directory")?;
    
    let possible_paths = vec![
        PathBuf::from(r"C:\Users\420247\Desktop\PROJECTFOLDERMAIN\void-browser\crawler"),
        exe_dir.join("..").join("..").join("..").join("..").join("crawler"),
        exe_dir.join("crawler"),
    ];
    
    let crawler_dir = possible_paths.into_iter()
        .find(|p| p.join("src").join("index.ts").exists())
        .ok_or("Could not find crawler directory. Make sure the crawler is installed.")?;
    
    let output_dir = app_data.join("crawled");
    fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    
    let mut tsx_args = format!(
        "tsx src/index.ts crawl \"{}\" -n \"{}\" -m {} -d {} -o \"{}\"",
        url,
        name,
        max_pages,
        max_depth,
        output_dir.to_string_lossy()
    );
    
    if screenshots {
        tsx_args.push_str(&format!(" -S --screenshot-delay {}", screenshot_delay));
    }
    
    // Run the crawler using cmd /c on Windows for proper PATH resolution
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(&["/c", &format!("cd /d \"{}\" && npx {}", crawler_dir.to_string_lossy(), tsx_args)])
        .output()
        .map_err(|e| format!("Failed to run crawler: {}", e))?;
    
    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh")
        .args(&["-c", &format!("cd \"{}\" && npx {}", crawler_dir.to_string_lossy(), tsx_args)])
        .output()
        .map_err(|e| format!("Failed to run crawler: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        let db_path = output_dir.join(format!("{}.db", name));
        
        if db_path.exists() {
            match import_crawler_db(app.clone(), db_path.to_string_lossy().to_string()).await {
                Ok(stats) => {
                    Ok(format!("Crawl complete! Imported {} nodes, {} edges.\n{}", 
                        stats.nodes_imported, stats.edges_imported, stdout))
                },
                Err(e) => {
                    Ok(format!("Crawl complete but import failed: {}\nDatabase saved to: {}\n{}", 
                        e, db_path.to_string_lossy(), stdout))
                }
            }
        } else {
            Ok(format!("Crawl complete!\n{}", stdout))
        }
    } else {
        Err(format!("Crawler failed:\nstdout: {}\nstderr: {}", stdout, stderr))
    }
}

#[tauri::command]
async fn get_crawled_dir(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let crawled_dir = app_data.join("crawled");
    fs::create_dir_all(&crawled_dir).map_err(|e| e.to_string())?;
    Ok(crawled_dir.to_string_lossy().to_string())
}

// ============== SESSION MANAGEMENT ==============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub name: String,
    pub path: String,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
    #[serde(rename = "nodeCount")]
    pub node_count: i32,
}

fn get_sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let sessions_dir = app_data.join("sessions");
    fs::create_dir_all(&sessions_dir).map_err(|e| e.to_string())?;
    Ok(sessions_dir)
}

#[tauri::command]
async fn get_current_session(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let marker_path = app_data.join("current_session.txt");
    
    if marker_path.exists() {
        fs::read_to_string(&marker_path).map_err(|e| e.to_string())
    } else {
        Ok("Default".to_string())
    }
}

fn set_current_session_internal(app: &tauri::AppHandle, name: &str) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let marker_path = app_data.join("current_session.txt");
    fs::write(&marker_path, name).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_current_session(app: tauri::AppHandle, name: String) -> Result<(), String> {
    set_current_session_internal(&app, &name)
}

#[tauri::command]
async fn list_sessions(app: tauri::AppHandle) -> Result<Vec<SessionInfo>, String> {
    let sessions_dir = get_sessions_dir(&app)?;
    let mut sessions = Vec::new();
    
    for entry in fs::read_dir(&sessions_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.extension().map_or(false, |ext| ext == "db") {
            let name = path.file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let node_count = if let Ok(conn) = Connection::open(&path) {
                conn.query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))
                    .unwrap_or(0)
            } else {
                0
            };
            
            let last_modified = fs::metadata(&path)
                .and_then(|m| m.modified())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|_| "Unknown".to_string());
            
            sessions.push(SessionInfo {
                name,
                path: path.to_string_lossy().to_string(),
                last_modified,
                node_count,
            });
        }
    }
    
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    
    Ok(sessions)
}

#[tauri::command]
async fn create_new_session(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let sessions_dir = get_sessions_dir(&app)?;
    let db_path = sessions_dir.join(format!("{}.db", name));
    
    if db_path.exists() {
        return Err(format!("Session '{}' already exists", name));
    }
    
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to create database: {}", e))?;
    
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            title TEXT,
            favicon TEXT,
            screenshot TEXT,
            position_x REAL DEFAULT 0,
            position_y REAL DEFAULT 0,
            position_z REAL DEFAULT 0,
            is_alive INTEGER DEFAULT 1,
            last_crawled TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            target_id INTEGER NOT NULL,
            FOREIGN KEY (source_id) REFERENCES nodes(id),
            FOREIGN KEY (target_id) REFERENCES nodes(id),
            UNIQUE(source_id, target_id)
        );
        CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);"
    ).map_err(|e| format!("Failed to create tables: {}", e))?;
    
    drop(conn);
    
    set_current_session_internal(&app, &name)?;
    
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let main_db = app_data.join("void.db");
    fs::copy(&db_path, &main_db).map_err(|e| format!("Failed to set as active: {}", e))?;
    
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_current_session(app: tauri::AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let main_db = app_data.join("void.db");
    
    if !main_db.exists() {
        return Err("No active session to save. Create some nodes first.".to_string());
    }
    
    {
        let conn = Connection::open(&main_db).map_err(|e| format!("Database error: {}", e))?;
        conn.query_row("SELECT COUNT(*) FROM nodes", [], |_| Ok(()))
            .map_err(|e| format!("Database validation failed: {}", e))?;
    }
    
    let current_name = get_current_session(app.clone()).await?;
    let sessions_dir = get_sessions_dir(&app)?;
    let session_db = sessions_dir.join(format!("{}.db", current_name));
    
    if session_db.exists() {
        fs::remove_file(&session_db).map_err(|e| format!("Failed to remove old save: {}", e))?;
    }
    
    fs::copy(&main_db, &session_db).map_err(|e| format!("Failed to save: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn save_session_as(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let main_db = app_data.join("void.db");
    
    if !main_db.exists() {
        return Err("No active session to save.".to_string());
    }
    
    fs::copy(&main_db, &path).map_err(|e| format!("Failed to save: {}", e))?;
    
    let name = PathBuf::from(&path)
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());
    
    set_current_session_internal(&app, &name)?;
    
    Ok(())
}

#[tauri::command]
async fn load_session(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let source_path = PathBuf::from(&path);
    if !source_path.exists() {
        return Err("Session file not found".to_string());
    }
    
    {
        let conn = Connection::open(&path).map_err(|e| format!("Failed to open session: {}", e))?;
        conn.query_row("SELECT COUNT(*) FROM nodes", [], |_| Ok(()))
            .map_err(|e| format!("Invalid session file: {}", e))?;
    }
    
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let main_db = app_data.join("void.db");
    
    if main_db.exists() {
        fs::remove_file(&main_db).map_err(|e| format!("Failed to remove old database: {}", e))?;
    }
    
    fs::copy(&path, &main_db).map_err(|e| format!("Failed to load: {}", e))?;
    
    let name = PathBuf::from(&path)
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());
    
    set_current_session_internal(&app, &name)?;
    
    Ok(())
}

#[tauri::command]
async fn delete_session(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let sessions_dir = get_sessions_dir(&app)?;
    let session_db = sessions_dir.join(format!("{}.db", name));
    
    if session_db.exists() {
        fs::remove_file(&session_db).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// ============== AUTO-CRAWL SYSTEM ==============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlResult {
    pub node_id: i64,
    pub title: Option<String>,
    pub favicon: Option<String>,
    pub is_alive: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    pub source_node_id: i64,
    pub links_found: i32,
    pub nodes_added: i32,
    pub edges_added: i32,
    pub new_node_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCrawlStatus {
    pub nodes_pending: i32,
    pub last_crawled_id: Option<i64>,
    pub last_crawled_url: Option<String>,
}

fn fetch_page_metadata(url: &str) -> Result<(Option<String>, Option<String>, bool), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Ok((None, None, false));
    }
    
    let html = response.text().map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html);
    
    let title_selector = Selector::parse("title").unwrap();
    let title = document.select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|t| !t.is_empty());
    
    let parsed_url = url::Url::parse(url).map_err(|e| e.to_string())?;
    let base_url = format!("{}://{}", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""));
    
    let favicon = {
        let icon_selectors = [
            r#"link[rel="icon"]"#,
            r#"link[rel="shortcut icon"]"#,
            r#"link[rel="apple-touch-icon"]"#,
        ];
        
        let mut found_favicon: Option<String> = None;
        
        for selector_str in &icon_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                if let Some(el) = document.select(&selector).next() {
                    if let Some(href) = el.value().attr("href") {
                        if href.starts_with("//") {
                            found_favicon = Some(format!("https:{}", href));
                        } else if href.starts_with('/') {
                            found_favicon = Some(format!("{}{}", base_url, href));
                        } else if href.starts_with("http") {
                            found_favicon = Some(href.to_string());
                        } else {
                            found_favicon = Some(format!("{}/{}", base_url, href));
                        }
                        break;
                    }
                }
            }
        }
        
        found_favicon.or_else(|| Some(format!("{}/favicon.ico", base_url)))
    };
    
    Ok((title, favicon, true))
}

fn fetch_page_metadata_with_links(url: &str) -> Result<(Option<String>, Option<String>, bool, Vec<String>), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Ok((None, None, false, vec![]));
    }
    
    let final_url = response.url().clone();
    let html = response.text().map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html);
    
    let title_selector = Selector::parse("title").unwrap();
    let title = document.select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|t| !t.is_empty());
    
    let parsed_url = url::Url::parse(final_url.as_str()).map_err(|e| e.to_string())?;
    let base_url = format!("{}://{}", parsed_url.scheme(), parsed_url.host_str().unwrap_or(""));
    
    let favicon = {
        let icon_selectors = [
            r#"link[rel="icon"]"#,
            r#"link[rel="shortcut icon"]"#,
            r#"link[rel="apple-touch-icon"]"#,
        ];
        
        let mut found_favicon: Option<String> = None;
        
        for selector_str in &icon_selectors {
            if let Ok(selector) = Selector::parse(selector_str) {
                if let Some(el) = document.select(&selector).next() {
                    if let Some(href) = el.value().attr("href") {
                        if href.starts_with("//") {
                            found_favicon = Some(format!("https:{}", href));
                        } else if href.starts_with('/') {
                            found_favicon = Some(format!("{}{}", base_url, href));
                        } else if href.starts_with("http") {
                            found_favicon = Some(href.to_string());
                        } else {
                            found_favicon = Some(format!("{}/{}", base_url, href));
                        }
                        break;
                    }
                }
            }
        }
        found_favicon.or_else(|| Some(format!("{}/favicon.ico", base_url)))
    };
    
    let mut links: Vec<String> = vec![];
    if let Ok(link_selector) = Selector::parse("a[href]") {
        for el in document.select(&link_selector) {
            if let Some(href) = el.value().attr("href") {
                let normalized = if href.starts_with("//") {
                    format!("https:{}", href)
                } else if href.starts_with('/') {
                    format!("{}{}", base_url, href)
                } else if href.starts_with("http") {
                    href.to_string()
                } else if !href.starts_with('#') && !href.starts_with("javascript:") && !href.starts_with("mailto:") {
                    format!("{}/{}", base_url, href)
                } else {
                    continue;
                };
                
                if normalized.starts_with("http://") || normalized.starts_with("https://") {
                    if let Ok(mut parsed) = url::Url::parse(&normalized) {
                        parsed.set_fragment(None);
                        let clean_url = parsed.to_string().trim_end_matches('/').to_string();
                        if !links.contains(&clean_url) && clean_url.len() < 500 {
                            links.push(clean_url);
                        }
                    }
                }
            }
        }
    }
    
    Ok((title, favicon, true, links))
}

fn generate_nearby_position(source_x: f64, source_y: f64, source_z: f64) -> (f64, f64, f64) {
    let mut rng = rand::thread_rng();
    let distance = rng.gen_range(8.0..20.0);
    let theta = rng.gen_range(0.0..std::f64::consts::TAU);
    let phi = rng.gen_range(-std::f64::consts::FRAC_PI_4..std::f64::consts::FRAC_PI_4);
    
    let x = source_x + distance * theta.cos() * phi.cos();
    let y = source_y + distance * phi.sin();
    let z = source_z + distance * theta.sin() * phi.cos();
    
    (x, y, z)
}

#[tauri::command]
async fn get_next_crawl_target(app: tauri::AppHandle, stale_days: i32) -> Result<Option<VoidNode>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(None);
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let query = format!(
        "SELECT id, url, title, favicon, screenshot, position_x, position_y, position_z, is_alive, last_crawled, created_at 
         FROM nodes 
         WHERE last_crawled IS NULL 
            OR last_crawled < datetime('now', '-{} days')
         ORDER BY 
            CASE WHEN last_crawled IS NULL THEN 0 ELSE 1 END,
            last_crawled ASC
         LIMIT 1",
        stale_days
    );
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let node = stmt.query_row([], |row| {
        Ok(VoidNode {
            id: row.get(0)?,
            url: row.get(1)?,
            title: row.get(2)?,
            favicon: row.get(3)?,
            screenshot: row.get(4)?,
            position_x: row.get(5)?,
            position_y: row.get(6)?,
            position_z: row.get(7)?,
            is_alive: row.get::<_, i32>(8)? == 1,
            last_crawled: row.get(9)?,
            created_at: row.get(10)?,
        })
    }).ok();
    
    Ok(node)
}

#[tauri::command]
async fn crawl_single_node(app: tauri::AppHandle, node_id: i64) -> Result<CrawlResult, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let url: String = conn.query_row(
        "SELECT url FROM nodes WHERE id = ?",
        params![node_id],
        |row| row.get(0)
    ).map_err(|e| format!("Node not found: {}", e))?;
    
    let result = std::thread::spawn(move || {
        fetch_page_metadata(&url)
    }).join().map_err(|_| "Thread panic")?;
    
    match result {
        Ok((title, favicon, is_alive)) => {
            conn.execute(
                "UPDATE nodes SET 
                    title = COALESCE(?, title),
                    favicon = COALESCE(?, favicon),
                    is_alive = ?,
                    last_crawled = datetime('now')
                 WHERE id = ?",
                params![
                    title,
                    favicon,
                    if is_alive { 1 } else { 0 },
                    node_id
                ]
            ).map_err(|e| e.to_string())?;
            
            Ok(CrawlResult {
                node_id,
                title,
                favicon,
                is_alive,
                error: None,
            })
        },
        Err(e) => {
            conn.execute(
                "UPDATE nodes SET is_alive = 0, last_crawled = datetime('now') WHERE id = ?",
                params![node_id]
            ).map_err(|e| e.to_string())?;
            
            Ok(CrawlResult {
                node_id,
                title: None,
                favicon: None,
                is_alive: false,
                error: Some(e),
            })
        }
    }
}

#[tauri::command]
async fn get_auto_crawl_status(app: tauri::AppHandle, stale_days: i32) -> Result<AutoCrawlStatus, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(AutoCrawlStatus {
            nodes_pending: 0,
            last_crawled_id: None,
            last_crawled_url: None,
        });
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let pending: i32 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM nodes 
             WHERE last_crawled IS NULL OR last_crawled < datetime('now', '-{} days')",
            stale_days
        ),
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let last_crawled = conn.query_row(
        "SELECT id, url FROM nodes WHERE last_crawled IS NOT NULL ORDER BY last_crawled DESC LIMIT 1",
        [],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    ).ok();
    
    Ok(AutoCrawlStatus {
        nodes_pending: pending,
        last_crawled_id: last_crawled.as_ref().map(|(id, _)| *id),
        last_crawled_url: last_crawled.map(|(_, url)| url),
    })
}

#[tauri::command]
async fn reset_all_crawl_timestamps(app: tauri::AppHandle) -> Result<i32, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(0);
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let count = conn.execute(
        "UPDATE nodes SET last_crawled = NULL",
        []
    ).map_err(|e| e.to_string())?;
    
    Ok(count as i32)
}

#[tauri::command]
async fn discover_links_from_node(
    app: tauri::AppHandle, 
    node_id: i64,
    max_new_nodes: i32,
    external_only: bool,
) -> Result<DiscoveryResult, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let (source_url, source_x, source_y, source_z): (String, f64, f64, f64) = conn.query_row(
        "SELECT url, position_x, position_y, position_z FROM nodes WHERE id = ?",
        params![node_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    ).map_err(|e| format!("Source node not found: {}", e))?;
    
    let source_domain = url::Url::parse(&source_url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_default();
    
    let url_clone = source_url.clone();
    let fetch_result = std::thread::spawn(move || {
        fetch_page_metadata_with_links(&url_clone)
    }).join().map_err(|_| "Thread panic")?;
    
    let (title, favicon, is_alive, links) = match fetch_result {
        Ok(result) => result,
        Err(e) => {
            conn.execute(
                "UPDATE nodes SET is_alive = 0, last_crawled = datetime('now') WHERE id = ?",
                params![node_id]
            ).ok();
            return Err(e);
        }
    };
    
    conn.execute(
        "UPDATE nodes SET 
            title = COALESCE(?, title),
            favicon = COALESCE(?, favicon),
            is_alive = ?,
            last_crawled = datetime('now')
         WHERE id = ?",
        params![title, favicon, if is_alive { 1 } else { 0 }, node_id]
    ).map_err(|e| e.to_string())?;
    
    let mut existing_urls: HashSet<String> = HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT url FROM nodes").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(url) = row {
                existing_urls.insert(url);
            }
        }
    }
    
    let mut nodes_added = 0;
    let mut edges_added = 0;
    let mut new_node_ids: Vec<i64> = vec![];
    
    for link in links.iter() {
        if nodes_added >= max_new_nodes {
            break;
        }
        
        if existing_urls.contains(link) {
            let target_id: Option<i64> = conn.query_row(
                "SELECT id FROM nodes WHERE url = ?",
                params![link],
                |row| row.get(0)
            ).ok();
            
            if let Some(tid) = target_id {
                let result = conn.execute(
                    "INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?, ?)",
                    params![node_id, tid]
                );
                if result.is_ok() && result.unwrap() > 0 {
                    edges_added += 1;
                }
            }
            continue;
        }
        
        if external_only {
            let link_domain = url::Url::parse(link)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()))
                .unwrap_or_default();
            if link_domain == source_domain {
                continue;
            }
        }
        
        let (x, y, z) = generate_nearby_position(source_x, source_y, source_z);
        
        let domain = url::Url::parse(link)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_string()))
            .unwrap_or_else(|| "Unknown".to_string());
        
        let insert_result = conn.execute(
            "INSERT INTO nodes (url, title, position_x, position_y, position_z, is_alive, created_at) 
             VALUES (?, ?, ?, ?, ?, 1, datetime('now'))",
            params![link, domain, x, y, z]
        );
        
        if let Ok(_) = insert_result {
            let new_id = conn.last_insert_rowid();
            new_node_ids.push(new_id);
            existing_urls.insert(link.clone());
            nodes_added += 1;
            
            conn.execute(
                "INSERT OR IGNORE INTO edges (source_id, target_id) VALUES (?, ?)",
                params![node_id, new_id]
            ).ok();
            edges_added += 1;
        }
    }
    
    Ok(DiscoveryResult {
        source_node_id: node_id,
        links_found: links.len() as i32,
        nodes_added,
        edges_added,
        new_node_ids,
    })
}

#[tauri::command]
async fn get_random_discovery_target(app: tauri::AppHandle) -> Result<Option<VoidNode>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(None);
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let node = conn.query_row(
        "SELECT id, url, title, favicon, screenshot, position_x, position_y, position_z, is_alive, last_crawled, created_at 
         FROM nodes 
         WHERE is_alive = 1
         ORDER BY RANDOM()
         LIMIT 1",
        [],
        |row| {
            Ok(VoidNode {
                id: row.get(0)?,
                url: row.get(1)?,
                title: row.get(2)?,
                favicon: row.get(3)?,
                screenshot: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                position_z: row.get(7)?,
                is_alive: row.get::<_, i32>(8)? == 1,
                last_crawled: row.get(9)?,
                created_at: row.get(10)?,
            })
        }
    ).ok();
    
    Ok(node)
}

#[tauri::command]
async fn get_node_count(app: tauri::AppHandle) -> Result<i32, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(0);
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM nodes",
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_site,
            get_db_path,
            init_database,
            get_screenshots_dir,
            save_screenshot,
            list_screenshots,
            open_screenshots_folder,
            delete_screenshot,
            import_crawler_db,
            list_crawler_dbs,
            run_crawler,
            get_crawled_dir,
            get_current_session,
            set_current_session,
            list_sessions,
            create_new_session,
            save_current_session,
            save_session_as,
            load_session,
            delete_session,
            get_next_crawl_target,
            crawl_single_node,
            get_auto_crawl_status,
            reset_all_crawl_timestamps,
            discover_links_from_node,
            get_random_discovery_target,
            get_node_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
