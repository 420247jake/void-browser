// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use std::fs;
use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use base64::{Engine as _, engine::general_purpose};
use rusqlite::{Connection, params};
use scraper::{Html, Selector};
use rand::Rng;

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
    
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
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
