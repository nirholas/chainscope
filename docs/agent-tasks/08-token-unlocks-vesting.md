# Agent Task 08: Token Unlock & Vesting Schedules

## Objective

Create a token unlocks panel that shows upcoming token vesting events across major protocols. This is high-alpha information for traders — large unlocks often create sell pressure.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`

## Data Sources

- **DeFiLlama Unlocks**: `https://api.llama.fi/unlocks` — token unlock data (if available)
- **Token Unlocks API**: Build from known vesting schedules of major protocols
- **CoinGecko**: For current token prices to calculate USD value of unlocks

Since there's no single free comprehensive API for token unlocks, implement a **hybrid approach**:
1. Maintain a static registry of known vesting schedules for top 30 tokens
2. Calculate upcoming unlocks from the schedule
3. Enrich with current prices from existing CoinGecko routes

## Files to Create

### 1. `src/config/token-vesting.ts` — Vesting Schedule Registry

```typescript
export interface VestingSchedule {
  token: string;
  symbol: string;
  coingeckoId: string;
  totalSupply: number;
  circulatingSupply: number;
  events: VestingEvent[];
  category: 'L1' | 'L2' | 'DeFi' | 'Infrastructure' | 'Gaming';
}

export interface VestingEvent {
  date: string;          // ISO date
  amount: number;        // Token amount
  percentOfSupply: number; // % of total supply
  recipient: string;     // 'team' | 'investors' | 'ecosystem' | 'community' | 'treasury' | 'advisors'
  cliff: boolean;        // Is this a cliff unlock?
  recurring?: string;    // 'monthly' | 'quarterly' | 'yearly' | null
  note?: string;
}

export const VESTING_SCHEDULES: VestingSchedule[] = [
  {
    token: 'Arbitrum',
    symbol: 'ARB',
    coingeckoId: 'arbitrum',
    totalSupply: 10_000_000_000,
    circulatingSupply: 3_250_000_000,
    category: 'L2',
    events: [
      { date: '2025-03-16', amount: 92_650_000, percentOfSupply: 0.93, recipient: 'team', cliff: false, recurring: 'monthly' },
      { date: '2025-04-16', amount: 92_650_000, percentOfSupply: 0.93, recipient: 'team', cliff: false, recurring: 'monthly' },
      // Continue monthly unlocks through 2027
    ]
  },
  {
    token: 'Optimism',
    symbol: 'OP',
    coingeckoId: 'optimism',
    totalSupply: 4_294_967_296,
    circulatingSupply: 1_200_000_000,
    category: 'L2',
    events: [
      // OP Foundation + investor unlocks
    ]
  },
  {
    token: 'Aptos',
    symbol: 'APT',
    coingeckoId: 'aptos',
    totalSupply: 1_084_721_789,
    circulatingSupply: 500_000_000,
    category: 'L1',
    events: [
      // Monthly unlocks for core contributors, investors
    ]
  },
  // Include 25+ more tokens:
  // SUI, SEI, STRK, TIA, JTO, PYTH, WLD, W, ZRO, EIGEN, JUP, PENDLE,
  // DYDX, IMX, MANTA, ALT, PIXEL, PORTAL, ETHFI, ONDO, etc.
];
```

**IMPORTANT:** Research and include accurate vesting schedules. These are publicly available in token documentation and tokenomics pages. Include upcoming events for the next 12 months (from current date).

### 2. `api/token-unlocks.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

This route:
1. Reads vesting schedules (inline condensed version since Edge can't import from src/)
2. Filters to upcoming events (next 30 days and next 90 days)
3. Fetches current prices from CoinGecko to calculate USD values
4. Sorts by date and impact (% of supply × price)

Response shape:
```json
{
  "timestamp": "...",
  "upcoming": [
    {
      "token": "Arbitrum",
      "symbol": "ARB",
      "date": "2025-03-16",
      "daysUntil": 5,
      "amount": 92650000,
      "percentOfSupply": 0.93,
      "valueUSD": 120445000,
      "recipient": "team",
      "cliff": false,
      "currentPrice": 1.30,
      "priceImpactRisk": "medium",
      "category": "L2"
    }
  ],
  "calendar": {
    "thisWeek": [...],
    "nextWeek": [...],
    "thisMonth": [...],
    "next90Days": [...]
  },
  "summary": {
    "totalValueNext7d": 450000000,
    "totalValueNext30d": 2100000000,
    "highestImpact": { "token": "ARB", "percentOfSupply": 0.93 },
    "upcomingCount": 15
  }
}
```

Price impact risk calculation:
- `high`: >5% of circulating supply unlocked in single event
- `medium`: 1-5% of circulating supply
- `low`: <1% of circulating supply

### 3. `src/components/TokenUnlocksPanel.ts` — Token Unlocks Panel

**Section 1: Upcoming Unlocks (sorted by date)**
- Each row: token icon/symbol, date (with "in X days" badge), amount, USD value, recipient tag (team/investor/etc), risk badge
- Color-code rows: red for high-impact, yellow for medium, gray for low

**Section 2: Calendar View**
- Week-by-week view showing total unlock value
- Simple bar chart showing daily/weekly unlock volume

**Section 3: Impact Ranking**
- Top unlocks sorted by % of supply being unlocked
- Show circulating supply change visualization

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { formatTvl } from '@/utils/defi-format';

export class TokenUnlocksPanel extends Panel {
  private data: any = null;
  private activeView: 'list' | 'calendar' | 'impact' = 'list';
  // ... standard panel pattern
  
  constructor() {
    super({ 
      id: 'token-unlocks', 
      title: 'Token Unlocks', 
      showCount: true,
      infoTooltip: 'Upcoming token vesting unlocks that may create sell pressure'
    });
    // ...
  }
}
```

### 4. `src/types/index.ts` — Add Types

```typescript
export interface TokenUnlock {
  token: string;
  symbol: string;
  date: string;
  daysUntil: number;
  amount: number;
  percentOfSupply: number;
  valueUSD: number;
  recipient: string;
  cliff: boolean;
  currentPrice: number;
  priceImpactRisk: 'high' | 'medium' | 'low';
  category: string;
}

export interface TokenUnlocksResult {
  timestamp: string;
  upcoming: TokenUnlock[];
  calendar: {
    thisWeek: TokenUnlock[];
    nextWeek: TokenUnlock[];
    thisMonth: TokenUnlock[];
    next90Days: TokenUnlock[];
  };
  summary: {
    totalValueNext7d: number;
    totalValueNext30d: number;
    highestImpact: { token: string; percentOfSupply: number };
    upcomingCount: number;
  };
}
```

### 5. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2:
```typescript
'token-unlocks': { name: 'Token Unlocks', enabled: true, priority: 1 },
```

### 6. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('token-unlocks', async () => {
  const { TokenUnlocksPanel } = await import('@/components/TokenUnlocksPanel');
  return new TokenUnlocksPanel();
});
```

## CSS Styling

- Risk badges: `.unlock-risk-high` (red bg), `.unlock-risk-medium` (yellow), `.unlock-risk-low` (green)
- Recipient tags: `.unlock-recipient` with color by type (team=blue, investor=purple, community=green)
- Days countdown: `.unlock-countdown` — red if ≤3 days, yellow if ≤7 days
- Value: `.unlock-value` in bold with USD formatting
- Calendar bars: `.unlock-calendar-bar` with height proportional to value
- List rows: `.unlock-row` with hover highlight

## Testing

1. `npm run typecheck` passes
2. Panel shows upcoming unlocks sorted by date
3. Risk badges display correctly
4. USD values calculated from current prices
5. Calendar view renders weekly bars
6. Graceful fallback if CoinGecko price fetch fails

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT make up vesting data — research actual schedules from protocol documentation
