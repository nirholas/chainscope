# Agent Task 15: DeFi Roadmap & Feature Flag Cleanup

## Objective

Two tasks in one:
1. Replace the legacy geopolitical roadmap with a comprehensive DeFi-focused roadmap
2. Gate the 9 productivity widgets behind a config flag so they don't dilute the DeFi brand

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Current `ROADMAP.md` is explicitly marked as "legacy" and proposes geopolitical features
- 9 productivity widgets exist: Notes, Calendar, Reminders, Alarm, Calculator, Notepad, Photo Gallery, Weather, Activity Streak
- Panel config in `src/config/panels.ts`, variant system in `src/config/variant.ts`

## Part 1: New DeFi Roadmap

### Replace `ROADMAP.md` with a comprehensive DeFi-focused roadmap

```markdown
# Chainscope HQ — DeFi Dashboard Roadmap

> Last updated: [current date]

## Vision

Chainscope HQ is the world's first **spatial DeFi intelligence platform** — combining a 3D globe, real-time market data, and AI-powered analysis into a command center for DeFi power users. Embedded in Chainscope as the `/hq` route, it provides the visual intelligence layer for AI agent-driven DeFi workflows.

## Completed ✅

### DeFi Market Data
- [x] Crypto prices (BTC/ETH/SOL + 20 tokens) via CoinGecko
- [x] DeFi yields browser (DeFiLlama)
- [x] Chain TVL rankings
- [x] DEX volume tracking
- [x] DEX trending tokens
- [x] Funding rates (Binance + Hyperliquid)
- [x] Open interest tracking
- [x] Long/short ratios
- [x] Liquidation monitoring
- [x] Gas tracker (7 chains: ETH, ARB, Base, OP, Polygon, BSC, AVAX)
- [x] Exchange flow heuristic
- [x] BTC ETF flow tracking
- [x] Stablecoin market health
- [x] Fear & Greed index
- [x] Top protocols by TVL
- [x] Protocol revenue/fees
- [x] DeFi global stats
- [x] Token trending topics (NLP extraction from 30 RSS feeds)
- [x] Sperax Protocol dashboard

### Analytics & Intelligence
- [x] DeFi Scanner (multi-signal opportunity detection)
- [x] Social sentiment analysis
- [x] Market movers (top gainers/losers)
- [x] Morning briefing (AI-generated daily summary)
- [x] Category breakdown (DEX, lending, derivatives, etc.)
- [x] Wallet tracker (read-only, multi-chain)
- [x] Compare Protocols tool
- [x] Price alerts (client-side)
- [x] TradingView chart integration
- [x] Hack/exploit alerts

### Infrastructure
- [x] Chainscope iframe bridge (postMessage)
- [x] Dashboard templates (7 built-in presets)
- [x] Custom template save/load
- [x] Variant system (full vs tech)
- [x] PWA + offline support
- [x] Tauri desktop app
- [x] 27+ 3D globe layers (legacy geopolitical)

## In Progress 🚧

### DeFi Globe Layers (Q1 2025)
Transform the 3D globe into DeFi's only spatial intelligence platform:
- [ ] Validator/node geographic distribution layer
- [ ] TVL heatmap by region (protocol HQ-based)
- [ ] Exchange & regulatory map layer
- [ ] Cross-chain bridge flow arcs
- [ ] Whale activity pulse layer

### On-Chain Data Integration (Q1 2025)
Move from aggregator-only to direct protocol data:
- [ ] The Graph subgraph integration (Uniswap, Aave, Compound)
- [ ] Lending rate comparison panel (cross-protocol)
- [ ] On-chain activity metrics (daily active addresses, tx count by chain)

### Real-Time Data (Q1 2025)
- [ ] WebSocket real-time price feeds (Binance streams)
- [ ] Live price flash animations
- [ ] Connection status indicator

## Planned 📋

### Q2 2025 — Advanced Analytics
- [ ] MEV & mempool monitoring panel
- [ ] Token unlock & vesting schedules
- [ ] Cross-chain bridge health monitor
- [ ] Historical time-series charts for all DeFi metrics (d3)
- [ ] Whale alert & large transaction monitor
- [ ] Governance & DAO proposal tracker (Snapshot + Tally)
- [ ] Airdrop eligibility tracker
- [ ] NFT floor price tracker (optional layer)

### Q3 2025 — AI Agent Integration
- [ ] Deep Chainscope AI agent context sharing
- [ ] Natural language DeFi queries ("what's the best USDC yield right now?")
- [ ] AI-powered trade signal generation
- [ ] Portfolio risk analysis agent tool
- [ ] Automated alert-to-action workflows

### Q4 2025 — Protocol-Specific Dashboards
- [ ] Uniswap deep analytics (pool depth, fee revenue, LP profitability)
- [ ] Aave utilization dashboard (real-time supply/borrow rates, health factors)
- [ ] Maker/Sky ecosystem dashboard
- [ ] Lido staking analytics
- [ ] Eigenlayer restaking monitor
- [ ] Hyperliquid derivatives analytics

### Future — Advanced Features
- [ ] DEX aggregator integration (swap execution from HQ)
- [ ] Multi-chain portfolio tracking (via Chainscope wallet)
- [ ] Custom alert rule builder (compound conditions)
- [ ] Dune Analytics query integration
- [ ] Chainlink oracle price discrepancy monitoring
- [ ] Cross-chain fee comparison calculator
- [ ] Protocol health scoring system
- [ ] DeFi risk heatmap (smart contract risk, oracle risk, governance risk)

## Architecture Improvements

- [ ] Extract DeckGLMap.ts into modular layer system
- [ ] Split App.ts orchestrator into feature modules
- [ ] Add TypeScript to API routes
- [ ] Implement API versioning
- [ ] Add comprehensive unit test coverage
- [ ] Migrate types to domain-specific files
- [ ] WebSocket connection pool management
- [ ] Service worker push notifications for alerts

## Legacy (Geopolitical) — Maintenance Mode

The following features are inherited from HQ's geopolitical intelligence origins. They remain functional but are not the development priority:
- Conflict/protest tracking (ACLED)
- Military base mapping
- Flight tracking (OpenSky)
- Vessel tracking (AIS)
- Nuclear facility mapping
- UCDP events
- Country Instability Index
- Infrastructure cascade
- Displacement flows
- Sanctions mapping

These layers are gated behind the `full` variant and can be toggled off. They may be deprecated in a future version if they create maintenance burden.

## Success Metrics

1. **Coverage**: >90% of top 100 DeFi protocols have data in HQ
2. **Latency**: <5 second time-to-first-meaningful-paint for any panel
3. **Uniqueness**: 5+ features no other DeFi dashboard offers (globe layers, spatial intelligence)
4. **Integration**: Full Chainscope AI agent tool coverage for all HQ data
5. **Reliability**: <1% error rate on API routes, graceful degradation on failures
```

## Part 2: Productivity Widget Feature Flag

### Modify `src/config/panels.ts`

Gate productivity widgets behind a config flag so they're hidden by default but can be enabled by users:

```typescript
// At top of file, add:
const SHOW_PRODUCTIVITY_WIDGETS = typeof localStorage !== 'undefined' 
  && localStorage.getItem('chainscope-show-productivity') === 'true';
```

Then modify the FULL_PANELS entries to conditionally include productivity widgets:

```typescript
// Change from:
'notes': { name: 'Notes', enabled: true, priority: 2 },
'calendar': { name: 'Calendar', enabled: true, priority: 2 },
// etc.

// To:
...(SHOW_PRODUCTIVITY_WIDGETS ? {
  'notes': { name: 'Notes', enabled: true, priority: 2 },
  'calendar': { name: 'Calendar', enabled: true, priority: 2 },
  'reminders': { name: 'Reminders', enabled: true, priority: 2 },
  'alarm': { name: 'Alarm & Timer', enabled: true, priority: 2 },
  'activity-streak': { name: 'Activity Streak', enabled: true, priority: 2 },
  'weather': { name: 'Weather', enabled: true, priority: 2 },
  'calculator': { name: 'Calculator', enabled: true, priority: 2 },
  'notepad': { name: 'Notepad', enabled: true, priority: 2 },
  'photo-gallery': { name: 'Photo Gallery', enabled: true, priority: 2 },
} : {}),
```

### Add Settings Toggle

In `settings.html` or the runtime config panel, add a toggle:
- Label: "Show Productivity Widgets"
- Description: "Enable Notes, Calendar, Reminders, and other productivity tools"
- Default: OFF
- Saves to `localStorage('chainscope-show-productivity')`
- Requires page refresh to take effect

### Update DEFI_TEMPLATE

If the DEFI_TEMPLATE dashboard preset includes productivity widgets, remove them from its `panelOrder` array.

## Testing

1. `npm run typecheck` passes
2. Productivity widgets are hidden by default in new sessions
3. Enabling the localStorage flag and refreshing shows them
4. DEFI_TEMPLATE doesn't include productivity widgets
5. ROADMAP.md contains the new DeFi-focused content
6. All existing functionality still works

## Do NOT

- Do NOT delete the productivity widget component files — just hide them from default config
- Do NOT introduce React
- Do NOT break existing user panel order (users who had these panels saved should still see them)
