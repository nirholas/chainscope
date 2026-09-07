# Agent Task 07: Governance & DAO Tracker

## Objective

Create a governance tracking panel that monitors active Snapshot votes, Tally on-chain proposals, and DAO activity across major DeFi protocols. Critical for power users who need to vote or track governance outcomes.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Panel components extend `Panel` from `src/components/Panel.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, panel config in `src/config/panels.ts`

## Data Sources

- **Snapshot GraphQL**: `https://hub.snapshot.org/graphql` — off-chain governance votes (free, no key needed)
- **Tally API**: `https://api.tally.xyz/query` — on-chain governance (free tier available)

Snapshot is the primary source — most DeFi protocols use Snapshot for governance.

## Files to Create

### 1. `api/governance.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Query Snapshot GraphQL for active and recent proposals from major DeFi spaces:

```graphql
query {
  proposals(
    first: 30
    skip: 0
    where: {
      space_in: ["aave.eth", "uniswapgovernance.eth", "ens.eth", "safe.eth", "arbitrumfoundation.eth", "opcollective.eth", "lido-snapshot.eth", "cvx.eth", "balancer.eth", "sushigov.eth", "snapshot.dcl.eth", "gmx.eth", "starknet.eth", "apecoin.eth", "comp-vote.eth"]
      state: "active"
    }
    orderBy: "created"
    orderDirection: desc
  ) {
    id
    title
    body
    choices
    start
    end
    state
    scores
    scores_total
    votes
    quorum
    space {
      id
      name
      avatar
      members
    }
    author
    type
    created
    link
  }
}
```

Also query recently closed proposals (state: "closed", last 20).

Response shape:
```json
{
  "timestamp": "...",
  "active": [
    {
      "id": "0x...",
      "title": "AIP-42: Deploy Aave V3 on ZKSync",
      "space": { "id": "aave.eth", "name": "Aave", "avatar": "https://..." },
      "state": "active",
      "choices": ["For", "Against", "Abstain"],
      "scores": [1250000, 320000, 50000],
      "scoresTotal": 1620000,
      "votes": 245,
      "quorum": 1000000,
      "quorumReached": true,
      "type": "single-choice",
      "startDate": "2024-...",
      "endDate": "2024-...",
      "timeLeft": "2 days",
      "link": "https://snapshot.org/#/aave.eth/proposal/0x..."
    }
  ],
  "recent": [
    { /* same shape, state: "closed", result: "For" */ }
  ],
  "spaces": [
    { "id": "aave.eth", "name": "Aave", "activeCount": 2, "memberCount": 15000 }
  ],
  "summary": {
    "activeProposals": 12,
    "spacesTracked": 15,
    "totalVotesActive": 3500,
    "highestParticipation": { "space": "Aave", "votes": 450 }
  }
}
```

### 2. `src/components/GovernancePanel.ts` — Governance Panel

**Section 1: Active Proposals (scrollable list)**
- Each proposal shows: protocol avatar + name, proposal title (truncated), vote bar (For/Against), votes count, time remaining, quorum badge
- Click to open Snapshot link

**Section 2: Recently Closed** 
- Shows outcome badge (Passed ✓ / Failed ✗), final vote split
- Collapsed by default, expandable

**Section 3: DAO Overview**
- Grid of tracked DAOs with active proposal count badges

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

export class GovernancePanel extends Panel {
  private data: any = null;
  private showRecent = false;
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({ 
      id: 'governance', 
      title: 'Governance', 
      showCount: true,
      infoTooltip: 'Active DAO proposals from Snapshot across major DeFi protocols'
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 5 * 60000);
  }

  // ... standard fetch, render, destroy pattern
}
```

### 3. `src/types/index.ts` — Add Types

```typescript
export interface GovernanceProposal {
  id: string;
  title: string;
  space: { id: string; name: string; avatar: string };
  state: 'active' | 'closed' | 'pending';
  choices: string[];
  scores: number[];
  scoresTotal: number;
  votes: number;
  quorum: number;
  quorumReached: boolean;
  type: string;
  startDate: string;
  endDate: string;
  timeLeft: string;
  link: string;
  result?: string;
}

export interface GovernanceResult {
  timestamp: string;
  active: GovernanceProposal[];
  recent: GovernanceProposal[];
  spaces: Array<{ id: string; name: string; activeCount: number; memberCount: number }>;
  summary: {
    activeProposals: number;
    spacesTracked: number;
    totalVotesActive: number;
    highestParticipation: { space: string; votes: number };
  };
}
```

### 4. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS` in Tier 2:
```typescript
'governance': { name: 'Governance', enabled: true, priority: 1 },
```

### 5. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('governance', async () => {
  const { GovernancePanel } = await import('@/components/GovernancePanel');
  return new GovernancePanel();
});
```

## CSS Styling

- Proposal cards: `.gov-proposal` with left border colored by protocol
- Vote bar: `.gov-vote-bar` with `.gov-vote-for` (green) and `.gov-vote-against` (red)
- Quorum badge: `.gov-quorum-badge` — green if reached, yellow if close, gray if far
- Time left: `.gov-time-left` — red if <24h, yellow if <3 days, gray otherwise
- Status badges: `.gov-status-active` (pulsing green dot), `.gov-status-passed` (green check), `.gov-status-failed` (red X)
- Protocol avatar: `.gov-space-avatar` (16x16 rounded image)
- DAO grid: `.gov-dao-grid` with `.gov-dao-chip` for each tracked DAO

## Tracked DAOs (Snapshot Spaces)

Include at least these 15 major DeFi governance spaces:
```
aave.eth, uniswapgovernance.eth, ens.eth, safe.eth, 
arbitrumfoundation.eth, opcollective.eth, lido-snapshot.eth, 
cvx.eth, balancer.eth, sushigov.eth, gmx.eth, starknet.eth,
apecoin.eth, comp-vote.eth, gitcoindao.eth
```

## Testing

1. `npm run typecheck` passes
2. Panel shows active proposals with vote bars
3. Time remaining updates correctly
4. Clicking proposal opens Snapshot link
5. Quorum badges show correct status
6. Graceful fallback if Snapshot API is down

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT require API keys (Snapshot GraphQL is free)
