# Third-Party Licenses

Void Browser is built on the shoulders of giants. Every dependency used in this project is properly licensed under permissive open-source licenses.

## License Scan Summary

**Scanned:** January 2025  
**Tools used:** `npx license-checker --production --summary`, `cargo license`

### Frontend (React/Three.js) - 92 packages
| License | Count |
|---------|-------|
| MIT | 75 |
| Apache-2.0 | 4 |
| MIT OR Apache-2.0 | 4 |
| ISC | 4 |
| BSD-3-Clause | 2 |
| Zlib | 1 |

### Crawler (Node.js) - 198 packages
| License | Count |
|---------|-------|
| MIT | 147 |
| Apache-2.0 | 16 |
| ISC | 14 |
| BSD-2-Clause | 14 |
| BSD-3-Clause | 3 |
| 0BSD | 1 |
| Python-2.0 | 1 |
| MIT OR WTFPL | 1 |

### Rust/Tauri Backend - 570+ crates
| License | Count |
|---------|-------|
| Apache-2.0 OR MIT (dual) | 374 |
| MIT | 138 |
| Unicode-3.0 | 18 |
| Apache-2.0 OR MIT OR Zlib | 21 |
| MPL-2.0 | 7 |
| Apache-2.0 | 4 |
| BSD-3-Clause | 4 |
| ISC | 3 |

**Total: ~860 packages/crates across all components**

---

## License Compatibility

✅ **All licenses are permissive and compatible with MIT.**

| License | Commercial | Modify | Distribute | Notes |
|---------|------------|--------|------------|-------|
| MIT | ✅ | ✅ | ✅ | Most permissive |
| Apache-2.0 | ✅ | ✅ | ✅ | Preserve NOTICE if present |
| BSD-2/3-Clause | ✅ | ✅ | ✅ | Keep copyright notice |
| ISC | ✅ | ✅ | ✅ | Functionally same as MIT |
| Zlib | ✅ | ✅ | ✅ | Very permissive |
| MPL-2.0 | ✅ | ✅ | ✅ | File-level copyleft only |
| Unicode-3.0 | ✅ | ✅ | ✅ | Unicode data tables |
| 0BSD | ✅ | ✅ | ✅ | Public domain equivalent |

**No GPL, AGPL, or other copyleft licenses detected.**

---

## Key Direct Dependencies

### Frontend
| Package | Version | License |
|---------|---------|---------|
| react | ^18.3.1 | MIT |
| react-dom | ^18.3.1 | MIT |
| three | ^0.172.0 | MIT |
| @react-three/fiber | ^8.17.14 | MIT |
| @react-three/drei | ^9.121.4 | MIT |
| @tauri-apps/api | ^2.5.0 | Apache-2.0 OR MIT |

### Crawler
| Package | Version | License |
|---------|---------|---------|
| axios | ^1.6.5 | MIT |
| better-sqlite3 | ^9.3.0 | MIT |
| cheerio | ^1.0.0 | MIT |
| puppeteer | ^22.0.0 | Apache-2.0 |

### Rust/Tauri
| Crate | License |
|-------|---------|
| tauri | Apache-2.0 OR MIT |
| tokio | MIT |
| reqwest | Apache-2.0 OR MIT |
| rusqlite | MIT |
| serde | Apache-2.0 OR MIT |

---

## Apache-2.0 Notice

Some dependencies use Apache-2.0, which requires preserving NOTICE files if present. Key Apache-2.0 dependencies:

- `puppeteer` (Google)
- `draco3d` (Google)
- `hls.js` (video-dev)
- `@mediapipe/tasks-vision` (Google)

If redistributing, ensure any NOTICE files from these packages are included.

---

## A Note on AI-Assisted Development

This project was developed with AI assistance (Claude). Using AI as a development tool is:

- ✅ **Legal** - AI tools are just tools
- ✅ **Ethical** - Same as using Stack Overflow or Copilot  
- ✅ **Industry standard** - Most developers use AI assistance

AI-assisted development is no different from using:
- Stack Overflow answers
- GitHub Copilot
- Code snippets from documentation
- IDE autocomplete

The final product is original work. The tools used to create it don't change that.

---

## Regenerating This Report

To verify or regenerate license information:

```bash
# Frontend
cd app && npx license-checker --production --summary

# Crawler
cd crawler && npx license-checker --production --summary

# Rust
cd app/src-tauri && cargo license
```

---

*Last updated: January 2025*  
*Generated for transparency. Because apparently some people need receipts.*
