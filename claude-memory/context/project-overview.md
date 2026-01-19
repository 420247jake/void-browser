# Void Browser - Project Context

## What Is This?
A 3D spatial browser where websites become glowing nodes in a neural network you can fly through. Instead of tabs and URLs, you navigate by moving through space toward memory orbs.

## The Vision
> "You're not browsing the web. You're inside the web."

## Core Experience
1. **Crawler** builds a graph of websites (nodes + edges)
2. **3D Void** renders them as glowing spheres with Tron-style connections
3. **Fly through** with WASD controls
4. **Enter a node** to view the live site (embedded webview)
5. **Vignette tunnel** effect as you approach/enter

## Tech Stack
- **Crawler:** Node.js + TypeScript + Cheerio + better-sqlite3
- **Desktop:** Tauri (Rust backend, web frontend)
- **3D:** React Three Fiber + drei + postprocessing
- **Storage:** SQLite (one .db file per "void")

## Visual Style
- Dark blue void (lighter sky, darker ground)
- Glowing spheres = alive sites
- Gray spheres = dead/inactive
- Neon lines = links between sites
- Bloom, glow, particles, fog
- Code Blue / Tron / Ghost in the Shell aesthetic

## Project Location
`C:/Users/420247/Desktop/PROJECTFOLDERMAIN/void-browser/`

## Key Directories
- `crawler/` - Node.js crawler (COMPLETE)
- `crawler/voids/` - SQLite databases
- `app/` - Tauri desktop app (TO BUILD)
- `claude-memory/` - Session persistence

## Completed Work
- ✅ Architecture doc locked
- ✅ Crawler engine working
- ✅ SQLite storage layer
- ✅ CLI with crawl/stats/list/export
- ✅ Test databases (test-void.db, hackernews.db)

## Next Up
- Phase 2: Tauri + Three.js 3D renderer
- Phase 3: Embedded webview
- Phase 4: Polish (effects, sounds, mini-map)
- Phase 5: Ship it
