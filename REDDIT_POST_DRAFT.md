# Void Browser Reddit Post Draft

**Created:** January 19, 2026

---

## 📝 Post Details

**Target Subreddit:** r/rust (best engagement), cross-post to r/tauri, r/programming

**Title:** 
> I built a 3D browser where you fly through the web like a video game - Void Browser [Tauri/Rust + Three.js]

---

## Post Body

```
Hey r/rust!

I've been working on something weird - a browser where websites are glowing orbs floating in space and you navigate with WASD like an FPS game.

**What is it?**
Void Browser turns the web into a 3D neural network. You add URLs, it crawls them, and each site becomes a node connected by neon lines showing link relationships. Then you literally fly through it.

**Tech Stack:**
- Tauri 2.0 (Rust backend)
- React + TypeScript + Three.js (React Three Fiber)
- SQLite for session storage
- Node.js crawler with Puppeteer

**Features:**
- WASD + mouse FPS controls
- Web crawler that spiders sites and builds your void
- Auto-discovery finds new sites from existing links
- Domain-based color coding
- Save/load different "voids"
- Cross-platform (Windows + macOS)

**Why Tauri?**
Wanted native performance for the 3D rendering without Electron's overhead. The Rust backend handles the SQLite database and system integration while keeping the bundle size small.

GitHub: https://github.com/420247jake/void-browser

Would love feedback on the concept or code. It's MIT licensed if anyone wants to poke around.
```

---

## 🎬 Media Checklist

Capture these before posting:

| # | What to Capture | Type | How |
|---|----------------|------|-----|
| **1** | Flying through nodes with several sites loaded | **GIF or short video (15-30s)** | Screen record while using WASD to fly around |
| **2** | The crawler in action - adding a URL and watching nodes appear | **GIF (10-15s)** | Press N, add URL, show nodes spawning |
| **3** | Static hero shot - zoomed out view of your void with lots of nodes | **Screenshot (PNG)** | Find a good angle with multiple connected nodes |
| **4** | Close-up of a glowing node with connections | **Screenshot (PNG)** | Get close to show the visual quality |

---

## 📤 Where to Upload Media

1. **Main GIF/Video** → Upload to [imgur](https://imgur.com) or directly to Reddit
2. **Screenshots** → Same, or use Reddit's gallery post feature
3. **If doing a gallery post** → Put the flying GIF first, then screenshots

---

## 🎯 Posting Strategy

1. **Primary:** r/rust (weekday morning EST gets best engagement)
2. **Cross-post to:** r/tauri, r/webdev
3. **Optional:** r/programming (bigger but harder to get traction)

---

## 📋 Pre-Post Checklist

- [ ] Fix GitHub Actions permissions (contents: write) - DONE
- [ ] Re-run build workflow successfully
- [ ] Capture flying-through GIF
- [ ] Capture crawler GIF
- [ ] Take hero screenshot
- [ ] Take close-up screenshot
- [ ] Upload media to imgur or Reddit
- [ ] Post to r/rust
- [ ] Cross-post to r/tauri
- [ ] Cross-post to r/webdev

---

## 🔧 Notes

- Best posting time: Weekday mornings EST (9-11am)
- Engage with comments quickly in first hour
- Be ready to answer technical questions about Tauri/Rust choices
