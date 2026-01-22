# Void Browser

> *"You're not browsing the web. You're inside the web."*

A 3D spatial browser where websites become glowing nodes in a neural network you can fly through. Navigate the internet by moving through space, not typing URLs.

![Void Browser](https://img.shields.io/badge/status-beta-blue) ![Tauri](https://img.shields.io/badge/tauri-2.0-orange) ![License](https://img.shields.io/badge/license-MIT-green)

![Void Browser Screenshot](screenshots/preview.png)

## ✨ Features

- **3D Web Visualization** - Websites rendered as glowing orbs connected by neon lines
- **Fly Through the Web** - WASD + mouse controls like a first-person game
- **Web Crawler** - Spider websites to build your void automatically
- **Auto-Crawl** - Background crawling keeps your void fresh
- **Auto-Discovery** - Discover new sites from existing node links
- **Session Management** - Save and load different voids
- **Screenshots** - Capture your void exploration
- **Domain Colors** - Each domain gets a unique color

## 🎮 Controls

| Key | Action |
|-----|--------|
| **WASD** | Move forward/back/strafe |
| **Space** | Move up |
| **Shift** | Move down |
| **Q / E** | Roll camera |
| **Ctrl** | Sprint |
| **Mouse** | Look around |
| **Click** | Lock mouse / Enter node |
| **ESC** | Unlock mouse |
| **N** | Add new URL |
| **C** | Crawl website |
| **I** | Import data |
| **F1** | Settings |
| **F2** | Screenshot |
| **G** | Gallery |
| **H** | Toggle help |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Rust (for Tauri)
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/420247jake/void-browser.git
cd void-browser

# Install app dependencies
cd app
npm install

# Run in development mode
npm run tauri dev
```

### Building for Production

```bash
# Build for your platform
npm run tauri build

# Output will be in app/src-tauri/target/release/bundle/
```

## 🕷️ Using the Crawler

The standalone crawler can be used to pre-build voids:

```bash
cd crawler
npm install
npm run dev -- https://example.com --max-nodes 100 --max-depth 2
```

Then import the generated `.db` file into the app.

## 🎨 Visual Style

- **Environment:** Dark blue void with stars
- **Nodes:** Glowing spheres with domain-based colors
- **Connections:** Neon lines showing link relationships
- **Effects:** Bloom, fog, particle effects

## 📦 Tech Stack

- **Frontend:** React + TypeScript + Three.js (React Three Fiber)
- **Backend:** Tauri (Rust)
- **Database:** SQLite
- **Crawler:** Node.js + Puppeteer + Cheerio

## 🗺️ Roadmap

- [x] Core 3D rendering
- [x] Web crawler
- [x] Auto-crawl system
- [x] Session management
- [x] Search & navigation
- [x] Domain clustering
- [x] Force-directed layout
- [x] Stats dashboard
- [x] Performance optimization
- [x] Windows/Mac installers
- [ ] Web demo

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Built by 420247jake
- Website: [jacobterrell.dev](https://jacobterrell.dev)
- GitHub: [@420247jake](https://github.com/420247jake)

---

*Navigate the void. Explore the web.*
