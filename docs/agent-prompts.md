# Agent Prompts for Chainscope HQ Features

Paste each prompt into a new Copilot chat (Claude Opus 4.6). Each agent is self-contained.

---

## Agent 1: Mobile/Responsive Guards

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard with a 3D WebGL globe. The project uses Vite 6, deck.gl, MapLibre GL, and d3. All components are vanilla TS classes manipulating the DOM directly.

## Your Task
Add mobile/responsive breakpoint guards for 5 recently-added interactive features that are desktop-only. These features should degrade gracefully on mobile (<768px or pointer:coarse) rather than showing broken interactions.

## What Needs Guards

### 1. Horizontal panel resize (right-side drag handle)
- File: `src/components/Panel.ts` (~515 lines)
- The `resizeHandleRight` element (class `panel-resize-handle-right`) lets users drag to widen panels across grid columns (col-span-2, col-span-3)
- On mobile: HIDE the right resize handle entirely. Column spanning doesn't work well on single-column grids.
- The bottom resize handle (`panel-resize-handle`) for height should remain on mobile.

### 2. Zone drag (dock panels beside chart)
- File: `src/App.ts` (~4,681 lines), method `setupZoneDrag()` at ~line 2420
- Users can drag panels from the grid into a `#chartSidebar` beside the chart, and back
- On mobile: SKIP `setupZoneDrag()` entirely. The chart sidebar would be too narrow. Hide `#chartSidebar` and `#chartDropZone` via CSS.

### 3. Panel add-back FAB
- File: `src/App.ts`, method `setupAddbackFab()` at ~line 2979
- A floating "+" button at bottom-right with a popover listing hidden panels
- On mobile: Move the FAB to bottom-center for thumb reach. Make the popover full-width at bottom (sheet style) instead of a small right-aligned dropdown. Increase touch targets to 44px minimum.

### 4. Dashboard templates modal
- File: `src/App.ts`, method `setupTemplatesModal()` at ~line 3118
- A modal with template cards in a grid
- On mobile: Template cards should stack vertically (1 column) instead of grid. Modal should be full-screen on small viewports.

### 5. Chart section resize handles
- File: `src/styles/main.css`, classes `.cs-resize-*` (8 directional handles: n, ne, e, se, s, sw, w, nw)
- On mobile: Hide corner handles (ne, se, sw, nw) — leave only N and S for height adjustment. Corner dragging is too fiddly on touch.

## Key Context

- Mobile detection utility: `src/utils/index.ts` exports `isMobileDevice()` which checks `window.innerWidth < 768 || pointer:coarse`
- App.ts has `this.isMobile` boolean set in constructor
- Existing mobile media queries in `main.css` use `@media (pointer: coarse), (max-width: 768px)` — follow this pattern
- The CSS file is `src/styles/main.css` (~16,277 lines)
- There are already mobile breakpoints at lines ~5050, ~7587, ~7804, ~13643, ~14812, ~15082, ~16080, ~16272

## Implementation Approach

1. **CSS-only where possible** — use `@media (pointer: coarse), (max-width: 768px)` to hide/adjust elements
2. **JS guards in App.ts** — use `this.isMobile` to skip `setupZoneDrag()` 
3. **Panel.ts** — use `isMobileDevice()` import to skip right-handle creation

## Rules
- Do NOT introduce React or any framework
- Do NOT split App.ts into multiple files  
- Run `npx tsc --noEmit` after changes to verify
- All CSS changes go in `src/styles/main.css` grouped together under a clear comment block
- Test with `get_errors` to confirm zero TypeScript errors
```

---

## Agent 2: Panel Search/Filter in Grid

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. All components are vanilla TS classes manipulating the DOM directly. Vite 6 build, ~16K lines of CSS in `src/styles/main.css`.

## Your Task
Add a quick search/filter input above the panels grid that filters visible panels by name as the user types. With 90+ panels, users need a fast way to find specific ones.

## Architecture

- `src/App.ts` (~4,681 lines) is the monolithic orchestrator
- Panels are rendered in `<div class="panels-grid" id="panelsGrid">` 
- Each panel element has `data-panel="key"` attribute
- Panel settings are in `this.panelSettings: Record<string, PanelConfig>` where PanelConfig has `{ name: string, enabled: boolean }`
- Lazy panels have placeholder elements with `data-lazy-panel="key"` attribute
- The header bar HTML is in the `render()` method, around line ~1440

## What to Build

### 1. Filter Bar
- Add a text input with search icon ABOVE the panels grid (between chart section and grid)
- Use a `<div class="panels-filter-bar">` wrapper containing:
  - Search icon (use "🔍" or SVG)
  - `<input type="text" placeholder="Filter panels..." id="panelFilterInput">`
  - Clear button (×) that appears when text is entered
  - Result count label: "Showing X of Y panels"

### 2. Filter Logic
- As user types, hide panels whose `panelSettings[key].name` doesn't match (case-insensitive substring)
- Filter should work on BOTH visible and lazy-loaded panel placeholders
- Preserve the panel's enabled/disabled state — filtering is visual only, not a toggle
- Hidden panels (disabled in settings) should stay hidden regardless of filter
- Use `requestAnimationFrame` or debounce (50ms) for smooth typing
- Empty filter = show all enabled panels

### 3. Keyboard Shortcut
- `/` key focuses the filter input (like GitHub)
- `Escape` clears and blurs the filter
- Don't activate `/` when user is already in an input/textarea

### 4. CSS Styling
- Match existing dashboard theme: dark background, `var(--border)`, `var(--text)`, `var(--text-dim)`, `var(--accent)` CSS variables
- Sticky at top of scroll area so it stays visible while scrolling panels
- Compact height (32-36px input)
- Transition: panels that don't match should fade out smoothly (opacity + height transition, or just display:none for performance)

## Key Files
- `src/App.ts` — add HTML in render(), add filter logic as a method, wire up in setupEventListeners()
- `src/styles/main.css` — add styles for `.panels-filter-bar`, `.panel-filter-input`, etc.

## Implementation Notes
- Panel elements can be found via `panelsGrid.querySelectorAll('[data-panel], [data-lazy-panel]')`
- Panel name lookup: `this.panelSettings[key]?.name`
- Add the filter bar HTML right before `<div class="panels-grid" id="panelsGrid">` in the render() method
- Add a new method `private setupPanelFilter(): void` and call it from initialization
- Don't forget to clear filter when switching templates (in `applyTemplate`)

## Rules
- Do NOT introduce React or any framework
- Do NOT split App.ts into multiple files
- Run typecheck after changes: `npx tsc --noEmit`
- Keep styling consistent with existing dark theme
```

---

## Agent 3: Notification/Alert Center

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi crypto dashboard with a 3D WebGL globe. All components are vanilla TS classes. The project has a signal aggregation system that detects market anomalies, news velocity spikes, cross-signal convergence, and other data signals.

## Your Task
Build a persistent notification center that surfaces signals and alerts from the existing signal system. Currently these signals are generated but only shown transiently (console logs, brief toasts, map flashes). Users need a persistent bell/notification area to review recent alerts.

## Existing Signal Infrastructure

### SignalAggregator (`src/services/signal-aggregator.ts`)
- Singleton: `signalAggregator` (exported instance)
- Ingests: outages, flights, vessels, protests, AIS disruptions, satellite fires, temporal anomalies
- Methods:
  - `getCountryClusters(): CountrySignalCluster[]` — countries with multi-signal convergence
  - `getRegionalConvergence(): RegionalConvergence[]` — regions with cross-country patterns
  - `getSummary(): SignalSummary` — overall signal counts and top items
- Types (all exported from signal-aggregator.ts):
  - `SignalType` — union of ~13 signal types
  - `GeoSignal` — lat/lon + country + type + timestamp
  - `CountrySignalCluster` — country + signals + convergenceScore + signalTypes
  - `RegionalConvergence` — description + countries + signals + convergenceScore

### Existing Toast (`src/App.ts`, line ~969)
- `showToast(msg: string)` — creates `.toast-notification`, auto-dismisses after 3s
- CSS at line ~2190 in main.css

### App.ts Signal Usage
- `signalAggregator.ingestOutages/Protests/Flights/Vessels/etc.` called during data refresh cycles
- Geographic convergence detected via `detectGeoConvergence()` from `src/services/geo-convergence.ts`
- Temporal anomalies via `updateAndCheck()` from `src/services/temporal-baseline.ts`
- Country instability spikes detected in `src/services/country-instability.ts`

## What to Build

### 1. NotificationCenter Component (`src/components/NotificationCenter.ts`)
Create a new vanilla TS class:

```typescript
interface Notification {
  id: string;
  type: 'convergence' | 'anomaly' | 'instability' | 'market' | 'info';
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  country?: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

Features:
- Bell icon button in the header bar (between LAYOUTS and PANELS buttons)
- Unread count badge on the bell
- Click opens a slide-out panel (right side, 360px wide) with notification list
- Notifications sorted newest-first
- Each notification: icon by type, title, body preview, relative timestamp ("2m ago")
- Click notification → mark as read + execute optional action (e.g., fly to country on map)
- "Mark all read" button in header
- "Clear all" button
- Max 50 notifications stored, auto-prune oldest
- Persist unread state in localStorage key `chainscope-notifications`
- Sound: optional subtle notification sound (use Web Audio API beep, not an audio file)

### 2. Integration in App.ts
- Import and instantiate NotificationCenter in the App constructor area
- Hook into signal aggregator results during refresh cycles:
  - After `detectGeoConvergence()` → if new convergence detected, push notification
  - After `updateAndCheck()` temporal baseline → if anomalies found, push notification  
  - After country instability calculation → if any country jumps 10+ points, push notification
  - After market data → if fear & greed index hits extreme (<20 or >80), push notification
- Deduplicate: don't fire same notification within 30 minutes (use a seen-keys cache)

### 3. Header Button
- Add bell button in the header HTML: `<button class="notif-bell-btn" id="notifBellBtn">🔔<span class="notif-badge" id="notifBadge">0</span></button>`
- Place it between the "🎨 LAYOUTS" and "⚙ PANELS" buttons in the header-right div

### 4. CSS Styling
- Add all styles in `src/styles/main.css`
- Match dark theme: `var(--bg-secondary)`, `var(--border)`, `var(--text)`, `var(--accent)`
- Slide-out panel: fixed right, full height, z-index 800, smooth slide transition
- Notification items: border-left colored by priority (red=critical, orange=high, blue=medium, gray=low)
- Unread items have slightly brighter background
- Badge: red circle with white text, positioned top-right of bell

## Key Files
- CREATE: `src/components/NotificationCenter.ts`
- EDIT: `src/components/index.ts` — add export
- EDIT: `src/App.ts` — import, instantiate, hook into signal refresh cycles
- EDIT: `src/styles/main.css` — notification styles

## Rules
- Do NOT introduce React or any framework
- Component must follow the vanilla TS class pattern (create DOM in constructor, append to parent)
- Do NOT split App.ts into multiple files
- Run typecheck after: `npx tsc --noEmit`
- Export the component from `src/components/index.ts`
```

---

## Agent 4: Chainscope postMessage Integration

```
You are working on Chainscope HQ — a vanilla TypeScript dashboard that runs standalone AND embeds inside Chainscope (a React 19/Next.js 16 app) via iframe at the `/hq` route. Communication between parent and iframe uses `window.postMessage`.

## Your Task
Build a bidirectional postMessage bridge so Chainscope can read HQ's dashboard state and send commands to it.

## Current State
- HQ has NO parent postMessage integration yet (only internal worker postMessage and YouTube embed origin handling)
- HQ's `vercel.json` has `frame-ancestors` CSP allowing these origins: `sperax.live`, `beta.sperax.chat`, `sperax.chat`, `chainscope.vercel.app`, `sperax.click`, `sperax.xyz`
- The parent app (Chainscope) will listen for messages from the HQ iframe

## What to Build

### 1. HQBridge Service (`src/services/hq-bridge.ts`)
Create a singleton service that manages all postMessage communication:

```typescript
const ALLOWED_ORIGINS = [
  'https://sperax.live',
  'https://beta.sperax.chat', 
  'https://sperax.chat',
  'https://chainscope.vercel.app',
  'https://sperax.click',
  'https://sperax.xyz',
  'http://localhost:3000',  // Chainscope dev
  'http://localhost:3001',
];

type HQEventType = 
  | 'hq:ready'
  | 'hq:template-changed'
  | 'hq:panel-toggled'
  | 'hq:country-selected'
  | 'hq:signal-detected'
  | 'hq:market-update'
  | 'hq:notification';

type HQCommandType =
  | 'sperax:apply-template'
  | 'sperax:toggle-panel'
  | 'sperax:fly-to-country'
  | 'sperax:set-theme'
  | 'sperax:request-state'
  | 'sperax:show-panel';
```

Features:
- **Outbound events (HQ → Chainscope):**
  - `hq:ready` — sent on initialization with version + variant info
  - `hq:template-changed` — when user switches dashboard template (template id + name)
  - `hq:panel-toggled` — when panel enabled/disabled (panel key + enabled state)
  - `hq:country-selected` — when user clicks a country on the map (country code + name)
  - `hq:signal-detected` — when geographic convergence or anomaly detected (summary)
  - `hq:market-update` — periodic market snapshot (BTC price, fear&greed, top movers)
  - `hq:notification` — when a notification is generated (if NotificationCenter exists)

- **Inbound commands (Chainscope → HQ):**
  - `sperax:apply-template` — switch to a specific template by id
  - `sperax:toggle-panel` — enable/disable a specific panel
  - `sperax:fly-to-country` — fly the map camera to a country
  - `sperax:set-theme` — future: switch color theme
  - `sperax:request-state` — request current dashboard state snapshot
  - `sperax:show-panel` — scroll a specific panel into view

- **Security:**
  - Validate `event.origin` against ALLOWED_ORIGINS on ALL inbound messages
  - Use specific `targetOrigin` (not `'*'`) for outbound messages — detect parent origin on init
  - Rate-limit inbound commands (max 10/second)
  - Sanitize all inbound data

### 2. Integration Points in App.ts

Hook the bridge into these existing methods:
- `applyTemplate()` → emit `hq:template-changed`
- `renderPanelToggles()` click handler → emit `hq:panel-toggled`  
- Map country click handler (search for `openCountryStory` or country click) → emit `hq:country-selected`
- Signal aggregator refresh results → emit `hq:signal-detected` (debounced, max 1/minute)
- Market data refresh → emit `hq:market-update` (debounced, max 1/minute)

Handle inbound commands:
- `sperax:apply-template` → call `this.applyTemplateById(id)`
- `sperax:toggle-panel` → toggle panel in `this.panelSettings` and apply
- `sperax:fly-to-country` → call `this.map?.flyTo(...)` 
- `sperax:request-state` → respond with current template, enabled panels, market data

### 3. Initialization
- Check `window !== window.parent` to detect iframe context
- If embedded, start the bridge and emit `hq:ready`
- If standalone (not in iframe), skip bridge initialization entirely — no overhead

## Key Context
- `src/App.ts` has `this.map: MapContainer | null` with method `flyTo(lat, lon, zoom)`
- Templates: `BUILTIN_TEMPLATES` from `src/config/panels.ts`, method `applyTemplateById(id)` in App.ts
- Panel settings: `this.panelSettings: Record<string, PanelConfig>` 
- Storage helper: `saveToStorage(key, value)` from `src/utils`
- The App class is instantiated in `src/main.ts`

## Key Files  
- CREATE: `src/services/hq-bridge.ts`
- EDIT: `src/services/index.ts` — export bridge
- EDIT: `src/App.ts` — import bridge, initialize in constructor, hook into methods
- No CSS needed

## Rules
- Do NOT introduce React or any framework
- Component follows singleton service pattern (like signalAggregator)
- Security is critical — validate origins, sanitize data, rate-limit
- Do NOT split App.ts into multiple files
- Run typecheck after: `npx tsc --noEmit`
- Keep the bridge lightweight — zero overhead when running standalone
```
