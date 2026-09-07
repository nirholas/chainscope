

## Agent 1: Nuclear + Irradiator → `facility-*` / `node-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Your task is to rename all "nuclear" and "irradiator" CSS classes and DOM identifiers to crypto-friendly names.

## Rename Mapping
| Old | New | Notes |
|-----|-----|-------|
| `nuclear-marker` | `facility-marker` | All modifier classes too (.active, .contested, .inactive) |
| `nuclear-label` | `facility-label` | |
| `nuclear-pulse` (keyframes) | `facility-pulse` | |
| `nuclear-alert` (keyframes) | `facility-alert` | |
| `nuclear-layer` (deck.gl) | `facility-layer` | |
| `.map-legend-icon.nuke` | `.map-legend-icon.facility` | |
| `data-layer-hidden-nuclear` | Keep as-is | This comes from MapLayers type key, too deep to rename |
| `data-labels-hidden-nuclear` | Keep as-is | Same reason |
| `irradiator-marker` | `node-marker` | |
| `irradiator-label` | `node-label` | |
| `.popup-header.irradiator` | `.popup-header.node` | |
| `irradiators-layer` (deck.gl) | `nodes-layer` | |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS (do NOT edit outside these ranges):
- Lines ~4190–4250: Nuclear marker styles (`.nuclear-marker`, `.nuclear-label`, `@keyframes nuclear-pulse`, `@keyframes nuclear-alert`)
- Lines ~4249–4290: Irradiator marker styles (`.irradiator-marker`, `.irradiator-label`, `.popup-header.irradiator`)
- Line ~5560: `.map-legend-icon.nuke` → `.map-legend-icon.facility`
- Lines ~3516: `.nuclear-marker.asset-highlight` → `.facility-marker.asset-highlight`
- Lines ~5927, 5944: Keep `data-layer-hidden-nuclear` and `data-labels-hidden-nuclear` in the attribute selectors, but rename the CLASS targets they hide: `.nuclear-marker` → `.facility-marker`, `.nuclear-label` → `.facility-label`
- Lines ~7587+ mobile section: Any `.nuclear-marker::before` touch target → `.facility-marker::before`

In those data-attribute CSS rules, you need to rename only the class part:
```css
/* OLD */
.map-wrapper[data-layer-hidden-nuclear="true"] .nuclear-marker,
/* NEW */  
.map-wrapper[data-layer-hidden-nuclear="true"] .facility-marker,
```

### 2. `src/components/Map.ts`
- Line ~1195: `div.className = 'nuclear-marker ${facility.status}'` → `div.className = 'facility-marker ${facility.status}'`
- Line ~1222: `div.className = 'irradiator-marker'` → `div.className = 'node-marker'`
- Any `nuclear-label` className assignment → `facility-label`
- Any `irradiator-label` className assignment → `node-label`

### 3. `src/components/DeckGLMap.ts`
- Line ~1149: layer id `'nuclear-layer'` → `'facility-layer'`
- Line ~1174: layer id `'irradiators-layer'` → `'nodes-layer'`

## Rules
- Do NOT rename MapLayers keys, file names, or TS class names
- Do NOT edit files not listed above
- Verify with `npx tsc --noEmit` after all changes
- Use find-and-replace carefully — nuclear appears in comments too, only rename CSS class names and classname strings
```

---

## Agent 2: Base Markers → `hub-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Your task is to rename all "base-marker" and "base-label" CSS classes (which represent military bases) to crypto-friendly "hub-marker" / "hub-label" names.

## Rename Mapping
| Old | New |
|-----|-----|
| `base-marker` | `hub-marker` |
| `base-label` | `hub-label` |
| `.map-legend-icon.base` | `.map-legend-icon.hub` |

All modifier classes follow: `.base-marker.us-nato` → `.hub-marker.us-nato`, `.base-marker.china` → `.hub-marker.china`, etc. The country modifier classes (us-nato, china, russia, uk, france, india, italy, uae, turkey, japan, other) stay the same — only the `base-` prefix changes.

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Line ~3514: `.base-marker.asset-highlight` → `.hub-marker.asset-highlight`
- Lines ~3871–3982: ALL base-marker and base-label selectors. This includes:
  - `.base-marker` (main), `.base-marker:hover`, `.base-marker.us-nato`, `.base-marker.china`, `.base-marker.russia`, `.base-marker.uk`, `.base-marker.france`, `.base-marker.india`, `.base-marker.italy`, `.base-marker.uae`, `.base-marker.turkey`, `.base-marker.japan`, `.base-marker.other`
  - `.base-label`, `.base-marker:hover .base-label`, `.base-marker.active .base-label`
  - All `.base-marker.{country} .base-label` color variants
- Line ~5561: `.map-legend-icon.base` → `.map-legend-icon.hub`
- Line ~5926: In the data-attribute rule, rename class target only:
  `.map-wrapper[data-layer-hidden-bases="true"] .base-marker` → `.map-wrapper[data-layer-hidden-bases="true"] .hub-marker`
  Keep `data-layer-hidden-bases` as-is (it comes from MapLayers key).
- Line ~5938: `.map-wrapper[data-labels-hidden-bases="true"] .base-label` → `...  .hub-label`
- Same for the `:not()` rule: `.map-wrapper:not([data-labels-hidden-bases="true"]) .base-label` → `... .hub-label`
- Lines ~7587+ mobile section: `.base-marker::before` → `.hub-marker::before`, `.base-marker` min-width → `.hub-marker`, `.base-label` → `.hub-label`

### 2. `src/components/Map.ts`
- Line ~1313: `div.className = 'base-marker ${base.type}'` → `div.className = 'hub-marker ${base.type}'`
- Line ~1318: `label.className = 'base-label'` → `label.className = 'hub-label'`

## Rules
- Do NOT rename `data-layer-hidden-bases` attribute name or MapLayers keys
- Do NOT edit files not listed above
- Only rename the CSS class prefix `base-` → `hub-`, keep all modifier classes unchanged
- Verify with `npx tsc --noEmit`
```

---

## Agent 3: Military Flights + Vessels + Clusters → `tracker-*` / `route-*` / `activity-cluster-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Your task is to rename all "military-flight", "military-vessel", and "military-cluster" CSS classes to crypto-friendly names.

## Rename Mapping
| Old | New | Notes |
|-----|-----|-------|
| `military-flight-marker` | `tracker-marker` | All operator/type modifiers stay (e.g. .usaf, .bomber) |
| `military-flight-icon` | `tracker-icon` | Including .bomber, .reconnaissance, .awacs, .fighter modifiers. Also rename `reconnaissance` modifier to `scanner` and `bomber` to `whale`, `fighter` to `bot`, `awacs` to `oracle` |
| `military-flight-label` | `tracker-label` | |
| `military-flight-altitude` | `tracker-altitude` | |
| `military-flight-track` | `tracker-track` | |
| `military-vessel-marker` | `route-marker` | Operator modifiers stay (.usn, .rn, .plan, .vks) |
| `military-vessel-icon` | `route-icon` | .submarine → .stealth, .carrier → .flagship, .dark-vessel → .dark-pool |
| `military-vessel-label` | `route-label` | |
| `military-vessel-track` | `route-track` | |
| `military-cluster-marker` | `activity-cluster` | |
| `.flight-cluster` modifier | `.tracker-cluster` | |
| `.vessel-cluster` modifier | `.route-cluster` | |
| `.exercise` modifier | `.accumulation` | |
| `.patrol` modifier | `.monitoring` | |
| `.deployment` modifier | `.distribution` | |
| `.transport` modifier | `.transfer` | |
| `military-vessels-layer` | `routes-layer` | deck.gl |
| `military-vessel-clusters-layer` | `route-clusters-layer` | deck.gl |
| `military-flights-layer` | `trackers-layer` | deck.gl |
| `military-flight-clusters-layer` | `tracker-clusters-layer` | deck.gl |
| `.popup-header.military-flight` | `.popup-header.tracker` | |
| `.popup-header.military-vessel` | `.popup-header.route` | |
| `.popup-header.militaryFlight` | `.popup-header.tracker` | |
| `.popup-header.militaryVessel` | `.popup-header.route` | |
| `.popup-header.militaryFlightCluster` | `.popup-header.tracker-cluster` | |
| `.popup-header.militaryVesselCluster` | `.popup-header.route-cluster` | |
| `.popup-header.military-cluster` | `.popup-header.activity-cluster` | |
| `.signal-chip.military` | `.signal-chip.tracker` | |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Lines ~6810–6978: ALL military-flight-* selectors (marker, icon, label, altitude, track + all modifiers)
- Lines ~6994–7133: ALL military-vessel-* selectors
- Lines ~7135–7296: ALL military-cluster-* selectors AND popup-header.military-* selectors
- Line ~12322: `.signal-chip.military` → `.signal-chip.tracker`
- Lines ~7587+ mobile: Any `military-flight-marker::before`, `military-vessel-marker::before` touch targets

Search for EVERY occurrence of `military-flight`, `military-vessel`, `military-cluster` in main.css and rename per the mapping.

### 2. `src/components/Map.ts`
Lines where className is set for military elements:
- ~L2091: `'military-flight-marker ${flight.operator} ${flight.aircraftType}'` → `'tracker-marker ${flight.operator} ${flight.aircraftType}'`
- ~L2097: `'military-flight-icon ${flight.aircraftType}'` → `'tracker-icon ${flight.aircraftType}'`
- ~L2105: `'military-flight-label'` → `'tracker-label'`
- ~L2113: `'military-flight-altitude'` → `'tracker-altitude'`
- ~L2159: `'military-cluster-marker flight-cluster ${cluster.activityType}'` → `'activity-cluster tracker-cluster ${cluster.activityType}'`
- ~L2194: `'military-vessel-marker ${vessel.operator} ${vessel.vesselType}'` → `'route-marker ${vessel.operator} ${vessel.vesselType}'`
- ~L2199: `'military-vessel-icon ${vessel.vesselType}'` → `'route-icon ${vessel.vesselType}'`
- ~L2216: `'military-vessel-label'` → `'route-label'`
- ~L2261: `'military-cluster-marker vessel-cluster ${cluster.activityType}'` → `'activity-cluster route-cluster ${cluster.activityType}'`

IMPORTANT: The activityType values (exercise, patrol, deployment, transport) come from data/types — do NOT rename them in the TS className assignments because they come from external data. Only rename them in CSS selectors where they appear as `.military-cluster-marker.exercise` etc. The CSS rename handles the mapping; the TS code will still emit the old activityType value, so add CSS aliases:
```css
.activity-cluster.exercise, .activity-cluster.accumulation { /* same styles */ }
```
Or just keep the old modifier names in CSS too (exercise, patrol, deployment, transport) since they come from data.

Actually, simpler: just keep the activity type modifiers as-is in both CSS and TS. Only rename the main class prefix.

### 3. `src/components/DeckGLMap.ts`
- ~L1487: `'military-vessels-layer'` → `'routes-layer'`
- ~L1500: `'military-vessel-clusters-layer'` → `'route-clusters-layer'`
- ~L1519: `'military-flights-layer'` → `'trackers-layer'`
- ~L1532: `'military-flight-clusters-layer'` → `'tracker-clusters-layer'`

### 4. `src/components/Map.ts` — popup header type strings
Search Map.ts for any place popup type is set to 'military-flight', 'military-vessel', 'militaryFlight', 'militaryVessel', 'military-cluster', 'militaryFlightCluster', 'militaryVesselCluster' and rename to 'tracker', 'route', 'activity-cluster', 'tracker-cluster', 'route-cluster'. Check popup rendering code.

## Rules
- Do NOT rename operator codes (usaf, usn, raf, plaaf, plan, vks, etc.)
- Do NOT edit files not listed above
- Keep activity type modifiers as-is (exercise, patrol, deployment, transport) — just rename the main class prefix
- Verify with `npx tsc --noEmit`
```

---

## Agent 4: Conflict → `risk-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename all "conflict" CSS classes to "risk" equivalents.

## Rename Mapping
| Old | New |
|-----|-----|
| `conflict-zone` | `risk-zone` |
| `conflict-label` | `risk-label` |
| `conflict-label-overlay` | `risk-label-overlay` |
| `conflict-click-area` | `risk-click-area` |
| `pulse-conflict` (keyframes) | `pulse-risk` |
| `.popup-header.conflict` | `.popup-header.risk` |
| `.map-legend-icon.conflict` | `.map-legend-icon.risk` |
| `.signal-chip.conflict` | `.signal-chip.risk` |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Lines ~3818–3868: `.conflict-zone`, `.conflict-label`, `.conflict-label-overlay`, `@keyframes pulse-conflict`
- Line ~5169: `.popup-header.conflict`
- Line ~5563: `.map-legend-icon.conflict`
- Line ~5578: `.conflict-click-area`
- Lines ~5929–5932: In data-attribute rules, rename class targets:
  `.map-wrapper[data-layer-hidden-conflicts="true"] .conflicts` — note: `.conflicts` is a GROUP class, rename to `.risks`
  `.map-wrapper[data-layer-hidden-conflicts="true"] .conflict-label-overlay` → `... .risk-label-overlay`
  `.map-wrapper[data-layer-hidden-conflicts="true"] .conflict-click-area` → `... .risk-click-area`
  `.map-wrapper[data-labels-hidden-conflicts="true"] .conflict-label-overlay` → `... .risk-label-overlay`
  Keep `data-layer-hidden-conflicts` attribute name as-is.
- Line ~13544: `.signal-chip.conflict` → `.signal-chip.risk`

### 2. `src/components/Map.ts`
- Line ~1249: `clickArea.className = 'conflict-click-area'` → `'risk-click-area'`
- Search for any `conflict-zone`, `conflict-label`, `conflict-label-overlay`, `.conflicts` class assignments and rename
- Search for popup type 'conflict' and rename to 'risk'

## Rules
- Do NOT rename `data-layer-hidden-conflicts` attribute name
- Do NOT rename the MapLayers key `conflicts`
- Do NOT edit files not listed above
- Verify with `npx tsc --noEmit`
```

---

## Agent 5: Protest → `event-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename all "protest" CSS classes to "event" equivalents.

## Rename Mapping
| Old | New |
|-----|-----|
| `protest-marker` | `event-marker` |
| `protest-icon` | `event-icon` |
| `protest-label` | `event-label` |
| `protest-pulse` (keyframes) | `event-pulse` |
| `.popup-header.protest` | `.popup-header.event` |
| `.signal-chip.protest` | `.signal-chip.event` |
| `protest-clusters-layer` (deck.gl) | `event-clusters-layer` |
| `protest-clusters-badge` (deck.gl) | `event-clusters-badge` |
| `protest-clusters-pulse` (deck.gl) | `event-clusters-pulse` |
| `--protest-color` CSS variable | `--event-color` |

Severity modifiers stay: `.low`, `.medium`, `.high`, `.riot`, `.validated`, `.cluster`

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Lines ~3636–3734: ALL protest-* selectors (marker, icon, label, keyframes, popup-header.protest)
- Line ~12321: `.signal-chip.protest` → `.signal-chip.event`
- Lines ~7587+ mobile: `protest-marker::before` → `event-marker::before`, `protest-label` → `event-label`
- Any `--protest-color` CSS variable → `--event-color`

### 2. `src/components/Map.ts`
- Line ~1999: `'protest-marker ${severity} ${eventType}'` → `'event-marker ${severity} ${eventType}'`
- Line ~2004: `'protest-icon'` → `'event-icon'`
- Search for any `protest-label` class assignment → `event-label`
- popup type 'protest' → 'event'

### 3. `src/components/DeckGLMap.ts`
- Line ~1658: `'protest-clusters-layer'` → `'event-clusters-layer'`
- Line ~1679: `'protest-clusters-badge'` → `'event-clusters-badge'`
- Line ~1699: `'protest-clusters-pulse'` → `'event-clusters-pulse'`

## Rules
- Do NOT rename MapLayers key `protests`
- Do NOT edit files not listed above
- Verify with `npx tsc --noEmit`
```

---

## Agent 6: Hotspot → `trend-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename all "hotspot" CSS classes to "trend" equivalents.

## Rename Mapping
| Old | New |
|-----|-----|
| `hotspot` (class) | `trend-zone` |
| `hotspot-marker` | `trend-marker` |
| `hotspot-label` | `trend-label` |
| `hotspot-breaking` | `trend-breaking` |
| `.popup-header.hotspot` | `.popup-header.trend` |
| `.hotspot-subtext` | `.trend-subtext` |
| `hotspots-layer` (deck.gl) | `trends-layer` |
| `hotspots-pulse` (deck.gl) | `trends-pulse` |

Modifiers stay: `.high`, `.elevated`

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Lines ~3365–3430: ALL hotspot* selectors
- Lines ~5173–5193: `.popup-header.hotspot`, `.popup-header.hotspot .popup-title`
- Line ~5391: `.hotspot-subtext`
- Lines ~7587+ mobile: `.hotspot::before`, `.hotspot` min-width, `.hotspot-label`, `.hotspot-marker`

### 2. `src/components/Map.ts`
- Line ~1278: `div.className = 'hotspot'` → `div.className = 'trend-zone'`
- Search for all `hotspot-marker`, `hotspot-label`, `hotspot-breaking` class assignments
- popup type 'hotspot' → 'trend'

### 3. `src/components/DeckGLMap.ts`
- Line ~1874: `'hotspots-layer'` → `'trends-layer'`
- Line ~1903: `'hotspots-pulse'` → `'trends-pulse'`

## Rules
- Do NOT rename MapLayers key `hotspots`
- Do NOT edit files not listed above
- Verify with `npx tsc --noEmit`
```

---

## Agent 7: Strategic Posture → `sector-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename all "posture" and "strategic-posture" CSS classes and panel identifiers to "sector" equivalents.

## Rename Mapping
| Old | New |
|-----|-----|
| Panel id `'strategic-posture'` | `'sector-overview'` |
| Panel title (whatever it is) | `'Sector Overview'` |
| Panel id `'strategic-risk'` | `'market-risk'` |
| Panel title for strategic-risk | `'Market Risk'` |
| `critical-posture-banner` | `critical-sector-banner` |
| `posture-panel` | `sector-panel` |
| `posture-theater` | `sector-region` |
| `posture-compact` | `sector-compact` |
| `posture-expanded` | `sector-expanded` |
| ALL `posture-*` CSS classes | `sector-*` | Same suffix, just replace `posture-` prefix with `sector-` |
| `strategic-risk-panel` | `market-risk-panel` |

This is the LARGEST single rename — ~75+ CSS selectors and ~40+ innerHTML template class names.

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Line ~8707: `.strategic-risk-panel` → `.market-risk-panel`
- Lines ~11573–12187: EVERYTHING with `posture` or `critical-posture`. Do a global find/replace within this range:
  - `critical-posture-` → `critical-sector-`
  - `posture-` → `sector-`
  This covers 75+ selectors. Be thorough.

### 2. `src/components/StrategicPosturePanel.ts`
- Change the panel `id` in constructor: `'strategic-posture'` → `'sector-overview'`
- Change the panel `title`: whatever it currently is → `'Sector Overview'`
- In ALL innerHTML templates, replace every `posture-` CSS class with `sector-`:
  `class="posture-panel"` → `class="sector-panel"`
  `class="posture-theater"` → `class="sector-region"`
  etc. Do a thorough find/replace of `posture-` → `sector-` within all template strings.
- Also replace `critical-posture-` → `critical-sector-`

### 3. `src/components/StrategicRiskPanel.ts`
- Change panel `id`: `'strategic-risk'` → `'market-risk'`
- Change panel `title` → `'Market Risk'`
- In innerHTML templates: `strategic-risk-panel` → `market-risk-panel`

### 4. `src/App.ts`
Search and replace these panel key references (there are many):
- `this.panels['strategic-posture']` → `this.panels['sector-overview']`
- `this.panels['strategic-risk']` → `this.panels['market-risk']`
- Any panelSettings key `'strategic-posture'` → `'sector-overview'`
- Any panelSettings key `'strategic-risk'` → `'market-risk'`
- In DEFAULT_PANELS config reference if it exists
- In template panelOrder arrays if these keys appear
- The `criticalBannerEl` class references: `'critical-posture-banner'` → `'critical-sector-banner'`

IMPORTANT: Be very careful with App.ts — it's 4,681 lines. Only change the specific string references listed above. Use exact string matching.

### 5. `src/config/panels.ts`
- Any panelOrder arrays containing `'strategic-posture'` → `'sector-overview'`
- Any panelOrder arrays containing `'strategic-risk'` → `'market-risk'`
- Panel display name in DEFAULT_PANELS if defined there

## Rules
- Do NOT rename the TS class names (keep `StrategicPosturePanel`, `StrategicRiskPanel` as class names)
- Do NOT rename file names
- Do NOT rename import paths
- Verify with `npx tsc --noEmit`
```

---

## Agent 8: CII → CRI (`cri-*`)

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename all "cii" (Country Instability Index) CSS classes and panel identifiers to "cri" (Country Risk Index).

## Rename Mapping
| Old | New |
|-----|-----|
| Panel id `'cii'` | `'cri'` |
| Panel title (likely "Country Instability Index") | `'Country Risk Index'` |
| ALL `cii-*` CSS classes | `cri-*` | Same suffix |
| `cii-share-btn` | `cri-share-btn` |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Line ~2244: `.cii-share-btn` → `.cri-share-btn`
- Lines ~8107–8314: ALL `cii-*` selectors. Do find/replace `cii-` → `cri-` in this range. This covers:
  `.cii-list`, `.cii-country`, `.cii-header`, `.cii-emoji`, `.cii-name`, `.cii-score`, `.cii-bar-container`, `.cii-bar`, `.cii-components`, `.cii-learning-banner`, `.cii-learning .cii-country`, `.cii-awaiting`, `.cii-scan-ring`, `.cii-scan-dot`, `.cii-awaiting-text`, `.cii-awaiting-sources`, `.cii-source-chip`
- Lines ~12257–12304: `.cii-section`, `.cii-label`, `.cii-badge`, `.cii-score-bar`, `.cii-score-fill`, `.cii-score-value`, `.cii-components`, `.cii-trend`, `.cii-trend.rising`, `.cii-trend.falling`, `.cii-trend.stable`

### 2. `src/components/CIIPanel.ts`
- Change panel `id`: `'cii'` → `'cri'`
- Change panel `title` → `'Country Risk Index'`
- In ALL innerHTML templates, replace `cii-` → `cri-`

### 3. `src/components/CountryIntelModal.ts`
- Replace all `cii-` class names in innerHTML: `cii-badge` → `cri-badge`, `cii-score-bar` → `cri-score-bar`, `cii-score-fill` → `cri-score-fill`, `cii-score-value` → `cri-score-value`, `cii-section` → `cri-section`, `cii-label` → `cri-label`, `cii-components` → `cri-components`, `cii-trend` → `cri-trend`

### 4. `src/components/CountryBriefPage.ts`
- Replace any `cii-` class names in innerHTML → `cri-`

### 5. `src/App.ts`
- Replace `this.panels['cii']` → `this.panels['cri']` (there are ~6 occurrences)
- Replace panel settings key `'cii'` → `'cri'`
- Replace any `as CIIPanel` casts — keep as `as CIIPanel` (TS class name doesn't change)

### 6. `src/config/panels.ts`
- Any DEFAULT_PANELS entry with key `'cii'` → `'cri'`

## Rules
- Do NOT rename the TypeScript class name `CIIPanel` — keep it as-is
- Do NOT rename the file `CIIPanel.ts`
- Do NOT rename imports
- Verify with `npx tsc --noEmit`
```

---

## Agent 9: Cascade + Intel → `impact-*` / `insights-*`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename "cascade" and "intel/intelligence" CSS classes to crypto-friendly names.

## Rename Mapping

### Cascade → Impact
| Old | New |
|-----|-----|
| Panel id `'cascade'` | `'impact'` |
| Panel title (likely "Infrastructure Cascade") | `'Impact Analysis'` |
| ALL `cascade-*` CSS classes | `impact-*` |

### GDELT Intel → News Insights
| Old | New |
|-----|-----|
| Panel id `'gdelt-intel'` | `'news-insights'` |
| Panel title (likely "GDELT Intelligence") | `'News Insights'` |
| ALL `gdelt-intel-*` CSS classes | `news-insights-*` |

### Intel Findings → Analysis Findings
| Old | New |
|-----|-----|
| `intel-findings-badge` | `analysis-findings-badge` |
| `intel-findings-dropdown` | `analysis-findings-dropdown` |

### Country Intel → Country Analysis
| Old | New |
|-----|-----|
| `country-intel-overlay` | `country-analysis-overlay` |
| `country-intel-modal` | `country-analysis-modal` |
| `country-intel-header` | `country-analysis-header` |
| `country-intel-title` | `country-analysis-title` |
| `country-intel-close` | `country-analysis-close` |
| `country-intel-content` | `country-analysis-content` |
| `country-intel-share-btn` | `country-analysis-share-btn` |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
YOUR CSS SECTIONS:
- Lines ~8514–8700: ALL `cascade-*` → `impact-*`
- Lines ~7926–8000: ALL `gdelt-intel-*` → `news-insights-*`
- Lines ~9616–9713: ALL `intel-findings-*` → `analysis-findings-*`
- Lines ~12192–12254: ALL `country-intel-*` → `country-analysis-*`
- Line ~2393: `.country-intel-share-btn` → `.country-analysis-share-btn`

### 2. `src/components/CascadePanel.ts`
- Change panel `id`: `'cascade'` → `'impact'`
- Change panel title → `'Impact Analysis'`
- In ALL innerHTML templates, replace `cascade-` → `impact-`

### 3. `src/components/GdeltIntelPanel.ts`
- Change panel `id`: `'gdelt-intel'` → `'news-insights'`
- Change panel title → `'News Insights'`
- In innerHTML: `gdelt-intel-` → `news-insights-`

### 4. `src/components/IntelligenceGapBadge.ts`
- In DOM creation: `intel-findings-badge` → `analysis-findings-badge`
- `intel-findings-dropdown` → `analysis-findings-dropdown`

### 5. `src/components/CountryIntelModal.ts`
- `country-intel-overlay` → `country-analysis-overlay`
- `country-intel-modal` → `country-analysis-modal`
- `country-intel-header` → `country-analysis-header`
- `country-intel-title` → `country-analysis-title`
- `country-intel-close` → `country-analysis-close`
- `country-intel-content` → `country-analysis-content`

### 6. `src/App.ts`
- `this.panels['cascade']` → `this.panels['impact']` 
- `this.panels['gdelt-intel']` → `this.panels['news-insights']`
- Panel settings keys: `'cascade'` → `'impact'`, `'gdelt-intel'` → `'news-insights'`

### 7. `src/config/panels.ts`
- DEFAULT_PANELS keys and any template panelOrder arrays

## Rules
- Do NOT rename TS class names (CascadePanel, GdeltIntelPanel, IntelligenceGapBadge, CountryIntelModal)
- Do NOT rename file names or imports
- Verify with `npx tsc --noEmit`
```

---

## Agent 10: Displacement + UCDP → `flow-*` / `geo-events`

```
You are working on Chainscope HQ — a vanilla TypeScript (NO React) DeFi dashboard. Rename "displacement" and "ucdp" panel identifiers and CSS to crypto-friendly names.

## Rename Mapping
| Old | New |
|-----|-----|
| Panel id `'displacement'` | `'flow-tracker'` |
| Panel title (likely "Population Displacement") | `'Flow Tracker'` |
| `.signal-chip.displacement` | `.signal-chip.flow` |
| `displacement-arcs-layer` (deck.gl) | `flow-arcs-layer` |
| Panel id `'ucdp-events'` | `'geo-events'` |
| Panel title (likely "UCDP Events" or "Conflict Events") | `'Geo Events'` |
| `ucdp-events-layer` (deck.gl) | `geo-events-layer` |

## Files to Edit (ONLY these)

### 1. `src/styles/main.css`
- Line ~13542: `.signal-chip.displacement` → `.signal-chip.flow`

### 2. `src/components/DisplacementPanel.ts`
- Change panel `id`: `'displacement'` → `'flow-tracker'`
- Change panel title → `'Flow Tracker'`

### 3. `src/components/UcdpEventsPanel.ts`
- Change panel `id`: `'ucdp-events'` → `'geo-events'`
- Change panel title → `'Geo Events'`

### 4. `src/components/DeckGLMap.ts`
- Line ~2852: `'ucdp-events-layer'` → `'geo-events-layer'`
- Line ~2875: `'displacement-arcs-layer'` → `'flow-arcs-layer'`

### 5. `src/App.ts`
- `this.panels['ucdp-events']` → `this.panels['geo-events']`
- `this.panels['displacement']` → `this.panels['flow-tracker']`
- Panel settings keys: `'ucdp-events'` → `'geo-events'`, `'displacement'` → `'flow-tracker'`

### 6. `src/config/panels.ts`
- DEFAULT_PANELS keys and template panelOrder arrays containing these keys

## Rules
- Do NOT rename the TS class names (DisplacementPanel, UcdpEventsPanel)
- Do NOT rename file names or imports
- Do NOT rename MapLayers keys (displacement, ucdpEvents)
- Verify with `npx tsc --noEmit`
```
