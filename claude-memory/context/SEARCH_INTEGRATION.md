# INTEGRATION GUIDE - Search Feature

## Files Created (Ready to Use)
1. `app/src/components/SearchModal.tsx` - Search UI component ✅
2. `app/src/lib/navigation.ts` - Camera teleport functionality ✅

## Manual Integration Required

Since App.tsx appears to be locked (possibly open in an editor), here are the changes to make manually:

### 1. Add Imports (at top of App.tsx)
```tsx
import { SearchModal } from "./components/SearchModal";
import { CameraTeleport, triggerTeleport } from "./lib/navigation";
```

### 2. Add State (in App function, with other useState calls)
```tsx
const [showSearch, setShowSearch] = useState(false);
```

### 3. Update anyModalOpen (include showSearch)
```tsx
const anyModalOpen = showGallery || showImport || showSettings || showCrawl || showUrlBar || showSearch;
```

### 4. Add Keyboard Handler for Ctrl+F (in handleKeyDown)
```tsx
// Add after other keybind checks
if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  setShowSearch(true);
}

// Also handle search modal escape
if (showSearch) {
  if (e.key === "Escape") {
    setShowSearch(false);
  }
  return;
}
```

### 5. Add Teleport Handler
```tsx
const handleTeleport = useCallback((nodeId: number, position: [number, number, number]) => {
  triggerTeleport(nodeId, position);
}, []);
```

### 6. Add CameraTeleport to Canvas (inside <Canvas>)
```tsx
{/* Camera Teleport - add after FlyControls */}
<CameraTeleport />
```

### 7. Add SearchModal to JSX (after other modals)
```tsx
{/* Search Modal */}
<SearchModal
  isOpen={showSearch}
  onClose={() => setShowSearch(false)}
  nodes={nodes}
  onTeleport={handleTeleport}
  onEnterNode={handleEnterNode}
/>
```

### 8. Update Controls Help (add search keybind)
```tsx
<span style={{ opacity: 0.6 }}>Ctrl+F</span><span>Search nodes</span>
```

---

## Quick Test
After integration:
1. Run `npm run tauri dev` in the app folder
2. Press Ctrl+F to open search
3. Type to filter nodes
4. Press Enter to teleport to selected node
5. Click "Open" to open site in new window

---

## Files Summary
- SearchModal.tsx: Full search UI with keyboard navigation
- navigation.ts: Camera teleport with smooth easing animation
