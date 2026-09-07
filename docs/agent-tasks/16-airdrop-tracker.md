# Agent Task 16: Airdrop Tracker Panel

## Objective

Create an airdrop tracking panel that shows upcoming, active, and recent DeFi airdrops. Popular feature for DeFi users who farm protocols for airdrop eligibility.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`

## Data Sources

- **DeFiLlama Airdrops**: Check if `https://api.llama.fi/airdrops` exists
- **Manual Registry**: Maintain a curated list of announced/rumored airdrops based on public information
- **Token lists**: Cross-reference with CoinGecko for tokens that recently launched (potential recent airdrops)

Since there's no single comprehensive free airdrop API, use a **curated static registry** supplemented with CoinGecko new token listings.

## Files to Create

### 1. `src/config/airdrops.ts` — Airdrop Registry

```typescript
export type AirdropStatus = 'upcoming' | 'claimable' | 'ended' | 'rumored';

export interface AirdropEntry {
  id: string;
  protocol: string;
  token: string;
  symbol: string;
  chain: string;
  status: AirdropStatus;
  description: string;
  claimUrl?: string;
  snapshotDate?: string;
  claimDeadline?: string;
  launchDate?: string;
  estimatedValue?: string;      // "~$500-$2000 for active users"
  eligibility: string[];        // ["Bridged to chain", "Used DEX", "Staked tokens", etc.]
  tasks?: string[];             // Actions to qualify
  confirmed: boolean;           // true = officially announced, false = rumored/speculated
  category: 'DeFi' | 'L1' | 'L2' | 'NFT' | 'Infrastructure' | 'Social';
  links: {
    website?: string;
    twitter?: string;
    announcement?: string;
    checker?: string;           // Eligibility checker URL
  };
}

export const AIRDROP_REGISTRY: AirdropEntry[] = [
  // Research and include currently relevant airdrops
  // Include both confirmed and rumored airdrops
  // Cover major protocols that haven't launched tokens yet
  // Include recently completed airdrops for reference
  
  // Example structure:
  {
    id: 'linea-mainnet',
    protocol: 'Linea',
    token: 'LINEA',
    symbol: 'LINEA',
    chain: 'Linea',
    status: 'rumored',
    description: 'Linea mainnet token distribution for early bridge & DeFi users',
    eligibility: ['Bridge to Linea', 'Use Linea DeFi protocols', 'Hold LXP points'],
    tasks: ['Bridge ETH via official bridge', 'Use 3+ DeFi protocols on Linea', 'Participate in Linea Voyage'],
    confirmed: false,
    category: 'L2',
    links: {
      website: 'https://linea.build',
      twitter: 'https://twitter.com/LineaBuild',
    }
  },
  // Add 30+ entries covering:
  // - Confirmed upcoming airdrops
  // - Rumored airdrops (major protocols without tokens)
  // - Recently claimable airdrops
  // - Recently completed airdrops (for reference)
];
```

### 2. `api/airdrops.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Returns the curated airdrop data enriched with current status:

Response shape:
```json
{
  "timestamp": "...",
  "airdrops": {
    "claimable": [
      {
        "id": "example-airdrop",
        "protocol": "Example",
        "token": "EXM",
        "chain": "Ethereum",
        "status": "claimable",
        "claimDeadline": "2025-06-01",
        "daysLeft": 45,
        "estimatedValue": "$500-$2000",
        "claimUrl": "https://...",
        "eligibility": ["Used protocol before snapshot"],
        "confirmed": true
      }
    ],
    "upcoming": [...],
    "rumored": [...],
    "recentlyEnded": [...]
  },
  "summary": {
    "claimableCount": 3,
    "upcomingCount": 5,
    "rumoredCount": 12,
    "totalEstimatedValue": "$5,000-$20,000",
    "urgentDeadlines": 2
  }
}
```

### 3. `src/components/AirdropTrackerPanel.ts` — Airdrop Tracker Panel

**Section 1: Active Claims (urgent, highlighted)**
- Claimable airdrops with deadline countdowns
- "Claim Now" button linking to claim URL
- Deadline urgency: red if <7 days, yellow if <30 days

**Section 2: Upcoming (confirmed)**
- Confirmed upcoming airdrops with expected dates
- Eligibility checklist
- Task list for qualification

**Section 3: Rumored (speculative)**
- Protocols rumored to airdrop
- Collapsible details with reasoning and tasks
- Confidence indicator (low/medium/high based on signals)

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

export class AirdropTrackerPanel extends Panel {
  private data: any = null;
  private activeTab: 'claimable' | 'upcoming' | 'rumored' = 'claimable';
  
  constructor() {
    super({
      id: 'airdrop-tracker',
      title: 'Airdrop Tracker',
      showCount: true,
      infoTooltip: 'Track upcoming, claimable, and rumored DeFi airdrops'
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 15 * 60000); // 15 min
  }
  // Standard panel pattern
}
```

### 4. `src/types/index.ts` — Add Types

```typescript
export type AirdropStatus = 'upcoming' | 'claimable' | 'ended' | 'rumored';

export interface Airdrop {
  id: string;
  protocol: string;
  token: string;
  symbol: string;
  chain: string;
  status: AirdropStatus;
  description: string;
  claimUrl?: string;
  claimDeadline?: string;
  daysLeft?: number;
  estimatedValue?: string;
  eligibility: string[];
  tasks?: string[];
  confirmed: boolean;
  category: string;
  links: Record<string, string | undefined>;
}

export interface AirdropTrackerResult {
  timestamp: string;
  airdrops: {
    claimable: Airdrop[];
    upcoming: Airdrop[];
    rumored: Airdrop[];
    recentlyEnded: Airdrop[];
  };
  summary: {
    claimableCount: number;
    upcomingCount: number;
    rumoredCount: number;
    totalEstimatedValue: string;
    urgentDeadlines: number;
  };
}
```

### 5. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2:
```typescript
'airdrop-tracker': { name: 'Airdrop Tracker', enabled: true, priority: 2 },
```

### 6. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('airdrop-tracker', async () => {
  const { AirdropTrackerPanel } = await import('@/components/AirdropTrackerPanel');
  return new AirdropTrackerPanel();
});
```

## CSS Styling

- Tabs: `.airdrop-tabs` with count badges per tab
- Claim card: `.airdrop-claim-card` with green accent border, large "Claim" button
- Deadline: `.airdrop-deadline` (red if urgent, yellow if soon)
- Countdown: `.airdrop-countdown` showing "X days left"
- Eligibility: `.airdrop-eligibility` checklist with checkmark icons
- Task: `.airdrop-task` list with numbered steps
- Rumored badge: `.airdrop-rumored` with dashed border and "?" icon
- Confirmed badge: `.airdrop-confirmed` with solid border and checkmark
- Chain badge: `.airdrop-chain` colored pill
- Estimated value: `.airdrop-value` in green

## Testing

1. `npm run typecheck` passes
2. Panel renders with tabs and airdrop entries
3. Deadline countdowns display correctly
4. Tab counts match data
5. Claim URLs open correctly
6. Eligibility checklists render
7. Graceful fallback — panel works even if API fails (static data)

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT present rumored airdrops as confirmed
- Do NOT include any financial advice — clearly label estimated values as speculative
