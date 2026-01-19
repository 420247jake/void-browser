# VOID BROWSER - Architecture Document

> *"You're not browsing the web. You're inside the web."*

A 3D spatial browser where websites become nodes in a neural network you can fly through. Crawled sites appear as glowing memory orbs floating in the void. You navigate by moving through space, not typing URLs.

---

## 🎯 PROJECT STATUS

**Current State:** ✅ MVP Complete - Adding Features
**Target:** Production Release + Web Demo

| Milestone | Status |
|-----------|--------|
| Crawler Engine | ✅ Complete |
| SQLite Storage | ✅ Complete |
| 3D Renderer | ✅ Complete |
| Auto-Crawl System | ✅ Complete |
| Auto-Discovery | ✅ Complete |
| Session Management | ✅ Complete |
| Feature Expansion | 🚧 In Progress (10 phases) |
| Packaging (.exe/.dmg) | ⬜ Pending |
| Web Demo | ⬜ Pending |

---

## The Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                         THE VOID                                 │
│                                                                  │
│                    ◉ ─────── ◉                                  │
│                   /           \                                  │
│              ◉───◉             ◉───◉                            │
│             /     \           /     \                            │
│            ◉       ◉─────────◉       ◉                          │
│                         │                                        │
│                         │                                        │
│                    [ YOU ARE HERE ]                              │
│                         ▲                                        │
│                                                                  │
│   Each ◉ is a website. Lines are links between them.            │
│   Brighter = more recent. Bigger = more content.                 │
│   Fly toward a node to "enter" it.                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 LOCKED DECISIONS

| Question | Decision |
|----------|----------|
| **Viewing sites** | Opens in new Tauri window |
| **Adding sites** | Manual paste, import bookmarks, OR crawler spider |
| **Node positions** | Auto-placed by code (force-directed planned) |
| **Crawl trigger** | One seed URL → spider to all connections recursively |
| **Storage** | SQLite (single `.db` file per void) |
| **Site mode** | Live sites only (no Wayback caching) |
| **Sessions** | Save/load different void configurations |
| **Desktop Shell** | Tauri (Rust) - ~10MB vs Electron's ~150MB |

---

## 📋 FEATURE EXPANSION PHASES

See `claude-memory/ACTIVE_TASK.md` for detailed breakdown.

| Phase | Name | Status |
|-------|------|--------|
| 1 | Search & Navigation | ⏳ Next |
| 2 | Node Context Menu | ⬜ TODO |
| 3 | Domain Clustering | ⬜ TODO |
| 4 | Stats Dashboard | ⬜ TODO |
| 5 | Visual Polish | ⬜ TODO |
| 6 | Import/Export | ⬜ TODO |
| 7 | Advanced Crawl | ⬜ TODO |
| 8 | Performance | ⬜ TODO |
| 9 | Packaging | ⬜ TODO |
| 10 | Web Demo | ⬜ TODO |

---

## Visual Style Guide

```
┌─────────────────────────────────────────────────────────────────┐
│                      VOID AESTHETICS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ENVIRONMENT:                                                   │
│   ├── Faint blue void (#0a0a1a)                                  │
│   ├── Stars in background (3000 count)                           │
│   ├── Fog for depth (30-150 range)                               │
│   └── Bloom post-processing                                      │
│                                                                  │
│   NODE STATES:                                                   │
│   ├── ◉ Colored glow = Domain-based color                       │
│   ├── ◎ Gray = Dead/inactive site                                │
│   └── ● Pulsing = Animation effect                               │
│                                                                  │
│   CONNECTIONS:                                                   │
│   ├── Neon lines between linked nodes                            │
│   ├── Color gradient from source to target                       │
│   └── (Planned: animated particles)                              │
│                                                                  │
│   COLORS (by domain):                                            │
│   ├── GitHub: #2ea44f (green)                                    │
│   ├── YouTube: #ff0000 (red)                                     │
│   ├── Twitter: #1da1f2 (blue)                                    │
│   └── Others: Hash-based unique colors                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────┐                   │
│   │           TAURI DESKTOP APP             │                   │
│   │  ┌─────────────────────────────────┐    │                   │
│   │  │      REACT FRONTEND             │    │                   │
│   │  │  ├── Three.js / R3F (3D)        │    │                   │
│   │  │  ├── @react-three/drei          │    │                   │
│   │  │  ├── @react-three/postprocessing│    │                   │
│   │  │  └── Tailwind CSS               │    │                   │
│   │  └─────────────────────────────────┘    │                   │
│   │  ┌─────────────────────────────────┐    │                   │
│   │  │       RUST BACKEND              │    │                   │
│   │  │  ├── SQLite (rusqlite)          │    │                   │
│   │  │  ├── HTTP Client (reqwest)      │    │                   │
│   │  │  ├── HTML Parser (scraper)      │    │                   │
│   │  │  └── Base64 encoding            │    │                   │
│   │  └─────────────────────────────────┘    │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
│   ┌─────────────────────────────────────────┐                   │
│   │         NODE.JS CRAWLER (CLI)           │                   │
│   │  ├── Puppeteer (screenshots)            │                   │
│   │  ├── Cheerio (HTML parsing)             │                   │
│   │  ├── better-sqlite3                     │                   │
│   │  └── Async queue with rate limiting     │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
void-browser/
├── ARCHITECTURE.md          # This file
├── start.bat                # Quick launch script
│
├── claude-memory/           # Session persistence for Claude
│   ├── ACTIVE_TASK.md       # Current work state
│   ├── QUICK_SAVE.md        # TL;DR for fast context load
│   ├── context/             # Additional context files
│   └── history/             # Past session logs
│
├── crawler/                 # Node.js crawler (standalone CLI)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts         # CLI entry
│   │   ├── crawler.ts       # Main crawler logic
│   │   ├── queue.ts         # URL queue
│   │   ├── fetcher.ts       # HTTP requests
│   │   ├── parser.ts        # HTML parsing
│   │   ├── screenshot.ts    # Puppeteer screenshots
│   │   ├── storage.ts       # SQLite layer
│   │   └── utils/
│   │       ├── normalizer.ts
│   │       └── rateLimit.ts
│   └── voids/               # Saved .db files from crawls
│
├── app/                     # Tauri desktop app
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   │
│   ├── src/                 # React frontend
│   │   ├── App.tsx          # Main app component
│   │   ├── main.tsx         # Entry point
│   │   ├── index.css        # Global styles
│   │   │
│   │   ├── components/
│   │   │   ├── VoidScene.tsx      # 3D scene container
│   │   │   ├── SiteNode.tsx       # Individual node mesh
│   │   │   ├── Connection.tsx     # Edge rendering
│   │   │   ├── FlyControls.tsx    # WASD + mouse controls
│   │   │   ├── TopBar.tsx         # Session controls
│   │   │   ├── SettingsPanel.tsx  # Settings UI
│   │   │   ├── CrawlModal.tsx     # Crawl launcher
│   │   │   ├── ImportModal.tsx    # Import data
│   │   │   └── Gallery.tsx        # Screenshot gallery
│   │   │
│   │   └── lib/
│   │       ├── database.ts        # SQLite client
│   │       ├── types.ts           # TypeScript types
│   │       ├── colors.ts          # Domain color mapping
│   │       └── useAutoCrawl.ts    # Auto-crawl hook
│   │
│   └── src-tauri/           # Rust backend
│       ├── Cargo.toml
│       ├── tauri.conf.json  # Build config
│       └── src/
│           ├── main.rs      # Entry point
│           └── lib.rs       # Tauri commands
│
└── web-demo/                # (PLANNED) Web demo for jacobterrell.dev
    ├── package.json
    ├── src/
    └── public/
```

---

## Database Schema

```sql
-- Nodes table (websites)
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon TEXT,              -- Base64 or URL
  screenshot TEXT,           -- Base64 image
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  position_z REAL NOT NULL DEFAULT 0,
  is_alive INTEGER NOT NULL DEFAULT 1,
  last_crawled TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Edges table (links between nodes)
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(source_id, target_id)
);

-- Indexes
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
```

---

## Controls

| Key | Action |
|-----|--------|
| WASD | Move forward/back/strafe |
| Space | Move up |
| Shift | Move down |
| Q / E | Roll camera |
| Ctrl | Sprint |
| Mouse | Look around |
| Click | Lock mouse / Enter node |
| ESC | Unlock mouse |
| N | Add new URL |
| C | Open crawl modal |
| I | Import data |
| F1 | Settings |
| F2 | Screenshot |
| G | Gallery |
| H | Toggle help |

---

## Commands

```bash
# Run Tauri app in development
cd app
npm run tauri dev

# Build for production
npm run tauri build

# Run crawler standalone
cd crawler
npm run dev -- https://example.com

# Build crawler
npm run build
```

---

## Deployment Targets

### Desktop (Phase 9)
- **Windows:** .exe installer via NSIS
- **macOS:** .dmg with signed app bundle
- **Linux:** .AppImage and .deb

### Web Demo (Phase 10)
- React-only build (no Tauri)
- Mock data (pre-crawled sample void)
- Deploy to jacobterrell.dev/void-demo
- Use Cloudflare Pages

---

*Document Version: 2.0.0*
*Last Updated: 2026-01-18*
*Status: MVP Complete - Feature Expansion In Progress*
