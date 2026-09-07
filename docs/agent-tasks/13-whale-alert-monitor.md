# Agent Task 13: Whale Alert & Large Transaction Monitor

## Objective

Create a whale transaction monitor that tracks large on-chain movements (exchange deposits/withdrawals, large transfers, smart contract interactions). Combine this with a globe layer showing whale activity pulses on the map.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6, deck.gl 9.2 + MapLibre GL 5.16
- Panel components extend `Panel` from `src/components/Panel.ts`
- 3D globe in `src/components/DeckGLMap.ts`
- API routes are Edge Runtime JavaScript in `api/`
- Types in `src/types/index.ts`, config in `src/config/panels.ts`

## Data Sources

- **Etherscan API**: `https://api.etherscan.io/api?module=account&action=txlist` — Ethereum large txs
- **Whale Alert API**: `https://api.whale-alert.io/v1/transactions` — cross-chain whale monitoring (free tier: 10 req/min)
- **Blockchain.com API**: `https://blockchain.info/unconfirmed-transactions?format=json` — BTC large txs
- **Alternative**: Monitor known whale/exchange wallets via Etherscan balance changes

Since Whale Alert free tier is limited, implement a hybrid approach:
1. Primary: Poll Etherscan for recent large ETH transfers (>100 ETH or >$500K ERC-20)
2. Secondary: Check known exchange hot wallets for large movements
3. Fallback: Static list of known recent whale movements from public data

## Files to Create

### 1. `src/config/whale-wallets.ts` — Known Wallet Registry

```typescript
export interface KnownWallet {
  address: string;
  label: string;
  type: 'exchange' | 'fund' | 'whale' | 'protocol' | 'bridge' | 'government';
  chain: 'ethereum' | 'bitcoin' | 'multi';
  entity?: string;
}

export const KNOWN_WALLETS: KnownWallet[] = [
  // Exchange hot wallets (public, from Etherscan labels)
  { address: '0x28c6c06298d514db089934071355e5743bf21d60', label: 'Binance Hot Wallet', type: 'exchange', chain: 'ethereum', entity: 'Binance' },
  { address: '0x21a31ee1afc51d94c2efccaa2092ad1028285549', label: 'Binance Hot Wallet 4', type: 'exchange', chain: 'ethereum', entity: 'Binance' },
  { address: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', label: 'Coinbase Hot Wallet', type: 'exchange', chain: 'ethereum', entity: 'Coinbase' },
  { address: '0x503828976d22510aad0201ac7ec88293211d23da', label: 'Coinbase Hot Wallet 2', type: 'exchange', chain: 'ethereum', entity: 'Coinbase' },
  { address: '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2', label: 'FTX Recovery', type: 'exchange', chain: 'ethereum', entity: 'FTX' },
  { address: '0x756d64dc5edb56740fc617628dc832ddbcfd373c', label: 'Kraken Hot Wallet', type: 'exchange', chain: 'ethereum', entity: 'Kraken' },
  // Government seizure wallets
  { address: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', label: 'US Gov Seized', type: 'government', chain: 'ethereum', entity: 'US Government' },
  // Known whales/funds
  // Add 40+ wallets from Etherscan labels, Arkham Intelligence public data
];
```

### 2. `api/whale-monitor.js` — Edge API Route

```javascript
export const config = { runtime: 'edge' };
```

Strategy:
1. Fetch recent large Ethereum transactions from Etherscan (blocks in last ~30 min)
2. Check if senders/receivers match known wallets
3. Filter for transactions > $500K
4. Classify: exchange_deposit, exchange_withdrawal, whale_transfer, bridge_deposit

Response shape:
```json
{
  "timestamp": "...",
  "transactions": [
    {
      "hash": "0x...",
      "chain": "ethereum",
      "from": { "address": "0x...", "label": "Unknown Whale", "type": "whale" },
      "to": { "address": "0x28c...", "label": "Binance Hot Wallet", "type": "exchange" },
      "value": 5000,
      "valueUSD": 17500000,
      "token": "ETH",
      "type": "exchange_deposit",
      "blockNumber": 19500000,
      "timestamp": "...",
      "significance": "high"
    }
  ],
  "summary": {
    "totalVolume1h": 250000000,
    "exchangeInflows": 120000000,
    "exchangeOutflows": 85000000,
    "netExchangeFlow": 35000000,
    "largestTx": { "hash": "0x...", "valueUSD": 25000000 },
    "alertCount": 5,
    "txCount": 25
  },
  "alerts": [
    {
      "type": "large_deposit",
      "message": "5,000 ETH ($17.5M) deposited to Binance",
      "significance": "high",
      "timestamp": "...",
      "hash": "0x..."
    }
  ]
}
```

**Note**: The Etherscan free tier is limited. Use `ETHERSCAN_API_KEY` env var if available, otherwise use a conservative polling rate and cache aggressively (5 min TTL).

### 3. `src/components/WhaleMonitorPanel.ts` — Whale Monitor Panel

**Section 1: Flow Summary**
- Net exchange flow (inflow vs outflow) as a gauge/bar
- Total whale volume (1h, 24h)
- Alert count badge

**Section 2: Live Transaction Feed**
- Scrolling list of recent whale transactions
- Each row: type icon (deposit/withdrawal/transfer), from→to (with labels), amount, USD value, time ago
- Color by type: green for outflow (bullish), red for inflow (bearish), blue for transfer

**Section 3: Alerts**
- High-significance whale movements
- Color-coded by type and significance level

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

export class WhaleMonitorPanel extends Panel {
  constructor() {
    super({
      id: 'whale-monitor',
      title: 'Whale Monitor',
      showCount: true,
      infoTooltip: 'Large on-chain transactions and exchange flow tracking'
    });
  }
  // Standard panel pattern with fetch, render, auto-refresh
}
```

### 4. Globe Layer — Whale Activity Pulses

Add a pulsing ScatterplotLayer to DeckGLMap.ts that shows recent whale activity on the globe:
- Map exchange wallets to exchange headquarters (Binance→Dubai, Coinbase→SF, etc.)
- Show pulsing dots at exchange locations when large deposits/withdrawals are detected
- Color: green pulse for outflows, red for inflows
- Animate with `currentTime` for pulse effect

Add to `MapLayers`:
```typescript
whaleActivity: boolean;
```

In DeckGLMap.ts:
```typescript
private createWhaleActivityLayer(): ScatterplotLayer {
  // Filter recent whale transactions (last 30 min)
  // Map to exchange coordinates
  // Use radiusMaxPixels proportional to transaction value
  // Use transitions for pulse animation
}
```

### 5. `src/types/index.ts` — Add Types

```typescript
export interface WhaleTransaction {
  hash: string;
  chain: string;
  from: { address: string; label: string; type: string };
  to: { address: string; label: string; type: string };
  value: number;
  valueUSD: number;
  token: string;
  type: 'exchange_deposit' | 'exchange_withdrawal' | 'whale_transfer' | 'bridge_deposit' | 'unknown';
  blockNumber: number;
  timestamp: string;
  significance: 'high' | 'medium' | 'low';
}

export interface WhaleMonitorResult {
  timestamp: string;
  transactions: WhaleTransaction[];
  summary: {
    totalVolume1h: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    netExchangeFlow: number;
    largestTx: { hash: string; valueUSD: number };
    alertCount: number;
    txCount: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    significance: string;
    timestamp: string;
    hash: string;
  }>;
}
```

### 6. `src/config/panels.ts` — Register

Add `'whale-monitor'` to FULL_PANELS in Tier 2.
Add `whaleActivity: false` to all map layer configs (enabled via toggle, not default).

### 7. `src/App.ts` — Lazy Factory

```typescript
this.lazyFactories.set('whale-monitor', async () => {
  const { WhaleMonitorPanel } = await import('@/components/WhaleMonitorPanel');
  return new WhaleMonitorPanel();
});
```

## Environment Variable

Optional: `ETHERSCAN_API_KEY` for higher rate limits on the Etherscan API.

## CSS Styling

- Transaction feed: `.whale-tx-row` with type-colored left border
- Type icons: `.whale-type-deposit` (red ↓), `.whale-type-withdrawal` (green ↑), `.whale-type-transfer` (blue ↔)
- Value: `.whale-value` in bold
- Address labels: `.whale-label` (truncated address with tooltip for full)
- Exchange flow gauge: `.whale-flow-gauge` with centered bar
- Alert: `.whale-alert` with pulsing left border for high significance
- Significance badges: `.whale-sig-high` (red), `.whale-sig-medium` (yellow), `.whale-sig-low` (gray)

## Testing

1. `npm run typecheck` passes
2. Panel shows transaction feed
3. Exchange flow summary displays correctly
4. Globe layer shows pulses at exchange locations
5. Alerts render with correct significance styling
6. Graceful fallback if Etherscan is unreachable

## Do NOT

- Do NOT introduce React
- Do NOT require Whale Alert API key (use Etherscan as primary)
- Do NOT modify existing panels
