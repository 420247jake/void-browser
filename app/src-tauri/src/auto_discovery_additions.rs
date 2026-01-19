// ============== AUTO-DISCOVERY ADDITIONS FOR lib.rs ==============
// Add these to your existing lib.rs file

// 1. Add this struct after CrawlResult:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    pub source_node_id: i64,
    pub links_found: i32,
    pub nodes_added: i32,
    pub edges_added: i32,
    pub new_node_ids: Vec<i64>,
}

// 2. Replace the fetch_page_metadata function with this enhanced version:
/// Fetch metadata for a single URL (title, favicon, and outbound links)
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
    
    // Extract title
    let title_selector = Selector::parse("title").unwrap();
    let title = document.select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|t| !t.is_empty());
    
    // Extract favicon
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
    
    // Extract outbound links
    let mut links: Vec<String> = vec![];
    if let Ok(link_selector) = Selector::parse("a[href]") {
        for el in document.select(&link_selector) {
            if let Some(href) = el.value().attr("href") {
                // Normalize the URL
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
                
                // Only include http/https links
                if normalized.starts_with("http://") || normalized.starts_with("https://") {
                    // Remove fragments and normalize
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

// 3. Add this helper function to generate random positions near a source node:
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

// 4. Add this new command for auto-discovery:
/// Discover new nodes from a source node's outbound links
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
    
    // Get source node
    let (source_url, source_x, source_y, source_z): (String, f64, f64, f64) = conn.query_row(
        "SELECT url, position_x, position_y, position_z FROM nodes WHERE id = ?",
        params![node_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    ).map_err(|e| format!("Source node not found: {}", e))?;
    
    let source_domain = url::Url::parse(&source_url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_default();
    
    // Fetch the page and extract links
    let fetch_result = std::thread::spawn(move || {
        fetch_page_metadata_with_links(&source_url)
    }).join().map_err(|_| "Thread panic")?;
    
    let (title, favicon, is_alive, links) = match fetch_result {
        Ok(result) => result,
        Err(e) => {
            // Update node as dead
            conn.execute(
                "UPDATE nodes SET is_alive = 0, last_crawled = datetime('now') WHERE id = ?",
                params![node_id]
            ).ok();
            return Err(e);
        }
    };
    
    // Update source node metadata
    conn.execute(
        "UPDATE nodes SET 
            title = COALESCE(?, title),
            favicon = COALESCE(?, favicon),
            is_alive = ?,
            last_crawled = datetime('now')
         WHERE id = ?",
        params![title, favicon, if is_alive { 1 } else { 0 }, node_id]
    ).map_err(|e| e.to_string())?;
    
    // Get existing URLs to avoid duplicates
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
        
        // Skip if URL already exists
        if existing_urls.contains(link) {
            // Still create edge if target exists
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
        
        // Check external_only filter
        if external_only {
            let link_domain = url::Url::parse(link)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()))
                .unwrap_or_default();
            if link_domain == source_domain {
                continue;
            }
        }
        
        // Generate position near source
        let (x, y, z) = generate_nearby_position(source_x, source_y, source_z);
        
        // Extract domain for title placeholder
        let domain = url::Url::parse(link)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_string()))
            .unwrap_or_else(|| "Unknown".to_string());
        
        // Insert new node
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
            
            // Create edge from source to new node
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

// 5. Add this command to get a random node for auto-discovery:
/// Get a random alive node for auto-discovery
#[tauri::command]
async fn get_random_discovery_target(app: tauri::AppHandle) -> Result<Option<VoidNode>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("void.db");
    
    if !db_path.exists() {
        return Ok(None);
    }
    
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    // Get a random alive node, prioritizing those that haven't been crawled recently
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

// 6. IMPORTANT: Add to invoke_handler! in run():
// discover_links_from_node,
// get_random_discovery_target,

// 7. Add to Cargo.toml dependencies:
// rand = "0.8"
