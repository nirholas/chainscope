# Agent Task 05: On-Chain Data — The Graph Subgraph Integration

## Objective

Add protocol-level on-chain data by querying The Graph's decentralized subgraphs. This gives HQ direct access to Uniswap pool depths, Aave utilization rates, Compound borrow/supply rates, and other protocol-specific metrics that aggregators like DeFiLlama don't provide.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- API routes are Edge Runtime JavaScript in `api/`
- Panel components extend `Panel` base class from `src/components/Panel.ts`
- All types in `src/types/index.ts`
- Panel registration in `src/config/panels.ts` and lazy loading in `src/App.ts`

## The Graph Access

The Graph has a free hosted service and a decentralized network. Use the decentralized gateway:
- Base URL: `https://gateway.thegraph.com/api/[api-key]/subgraphs/id/[subgraph-id]`
- For free tier (no API key): `https://api.thegraph.com/subgraphs/name/[org]/[name]`
- Uniswap V3 Ethereum: `https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
- Aave V3 Ethereum: `https://gateway.thegraph.com/api/subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g`

Since API keys may be needed, support an optional `THEGRAPH_API_KEY` env var, but also include fallback to free endpoints.

## Files to Create

### 1. `api/subgraph-uniswap.js` — Uniswap Pool Data

```javascript
export const config = { runtime: 'edge' };
```

Query Uniswap V3 subgraph for:
- Top pools by TVL
- 24h volume per pool
- Fee tier distribution
- Price data for major pairs

GraphQL query:
```graphql
{
  pools(first: 30, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    token0 { symbol name decimals }
    token1 { symbol name decimals }
    feeTier
    totalValueLockedUSD
    volumeUSD
    token0Price
    token1Price
    txCount
    liquidity
  }
}
```

Response shape:
```json
{
  "timestamp": "...",
  "pools": [
    {
      "id": "0x...",
      "pair": "WETH/USDC",
      "token0": { "symbol": "WETH", "name": "Wrapped Ether" },
      "token1": { "symbol": "USDC", "name": "USD Coin" },
      "feeTier": 500,
      "feeTierDisplay": "0.05%",
      "tvl": 450000000,
      "volume24h": 120000000,
      "price": 3500.25,
      "txCount": 15000,
      "utilization": 0.267
    }
  ],
  "summary": {
    "totalTvl": 3200000000,
    "totalVolume24h": 1100000000,
    "poolCount": 30,
    "topPair": "WETH/USDC",
    "avgUtilization": 0.34
  }
}
```

### 2. `api/subgraph-aave.js` — Aave Lending Data

Query Aave V3 subgraph for:
- Reserve markets (supply/borrow rates, utilization, total supplied/borrowed)
- Top markets by TVL

GraphQL query:
```graphql
{
  reserves(first: 30, orderBy: totalLiquidity, orderDirection: desc, where: { isActive: true }) {
    id
    symbol
    name
    underlyingAsset
    totalLiquidity
    totalCurrentVariableDebt
    totalPrincipalStableDebt
    availableLiquidity
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    utilizationRate
    price { priceInEth }
    aToken { id }
  }
}
```

Response shape:
```json
{
  "timestamp": "...",
  "markets": [
    {
      "symbol": "WETH",
      "name": "Wrapped Ether",
      "totalSupplied": 2500000,
      "totalBorrowed": 850000,
      "available": 1650000,
      "supplyAPY": 2.15,
      "borrowAPY": 3.42,
      "stableBorrowAPY": 5.1,
      "utilization": 0.34,
      "tvlUSD": 8750000000
    }
  ],
  "summary": {
    "totalTvl": 15000000000,
    "totalBorrowed": 5500000000,
    "avgUtilization": 0.367,
    "topMarket": "WETH",
    "marketCount": 30
  }
}
```

### 3. `api/subgraph-compound.js` — Compound Lending Data

Similar to Aave, query Compound V3 subgraph for lending markets:
- Use Compound V3 (Comet) subgraph
- Endpoint: `https://api.thegraph.com/subgraphs/name/messari/compound-v3-ethereum`

### 4. `src/components/OnChainPanel.ts` — Combined On-Chain Data Panel

A tabbed panel showing data from all three protocols:

```typescript
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { formatTvl } from '@/utils/defi-format';

export class OnChainPanel extends Panel {
  private activeTab: 'uniswap' | 'aave' | 'compound' = 'uniswap';
  private uniswapData: any = null;
  private aaveData: any = null;
  private compoundData: any = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({ id: 'on-chain', title: 'On-Chain Data', showCount: true, infoTooltip: 'Live protocol data from The Graph subgraphs' });
    void this.fetchAll();
    this.refreshInterval = setInterval(() => this.fetchAll(), 5 * 60000);
  }

  // Tab switching, data fetching, rendering for each tab
  // Uniswap tab: pool table with TVL, volume, fee tier, utilization
  // Aave tab: market table with supply APY, borrow APY, utilization bar
  // Compound tab: similar to Aave
}
```

Render each tab with:
- **Uniswap**: Pool pair, fee tier badge (0.01%/0.05%/0.3%/1%), TVL, 24h volume, utilization bar
- **Aave**: Asset, supply APY (green), borrow APY (yellow), utilization progress bar, TVL
- **Compound**: Asset, supply APY, borrow APY, utilization, collateral factor

### 5. `src/types/index.ts` — Add Types

```typescript
export interface UniswapPool {
  id: string;
  pair: string;
  token0: { symbol: string; name: string };
  token1: { symbol: string; name: string };
  feeTier: number;
  feeTierDisplay: string;
  tvl: number;
  volume24h: number;
  price: number;
  txCount: number;
  utilization: number;
}

export interface AaveLendingMarket {
  symbol: string;
  name: string;
  totalSupplied: number;
  totalBorrowed: number;
  available: number;
  supplyAPY: number;
  borrowAPY: number;
  stableBorrowAPY: number;
  utilization: number;
  tvlUSD: number;
}

export interface CompoundMarket {
  symbol: string;
  name: string;
  totalSupplied: number;
  totalBorrowed: number;
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  tvlUSD: number;
}
```

### 6. `src/config/panels.ts` — Register Panel

Add to `FULL_PANELS`:
```typescript
'on-chain': { name: 'On-Chain Data', enabled: true, priority: 1 },
```

Place it in Tier 2 section (after `'chain-tvl'`).

### 7. `src/App.ts` — Lazy Factory

Add lazy factory in `createPanels()`:
```typescript
this.lazyFactories.set('on-chain', async () => {
  const { OnChainPanel } = await import('@/components/OnChainPanel');
  return new OnChainPanel();
});
```

## CSS Styling

Add styles in the component or in `src/styles/`. Use the existing panel style patterns:
- Tab bar: `.on-chain-tabs` with `.on-chain-tab` buttons
- Active tab: `.on-chain-tab.active`
- Pool/market rows: `.on-chain-row`
- Utilization bar: `.on-chain-util-bar` with inner `.on-chain-util-fill`
- APY values: `.on-chain-supply-apy` (green), `.on-chain-borrow-apy` (yellow/orange)
- Fee tier badges: `.on-chain-fee-badge`

## Environment Variable

Add optional `THEGRAPH_API_KEY` support:
```javascript
const apiKey = process.env.THEGRAPH_API_KEY || '';
const baseUrl = apiKey
  ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/`
  : 'https://api.thegraph.com/subgraphs/name/';
```

## Testing

1. `npm run typecheck` passes
2. Panel renders with three tabs
3. Each tab shows correct data from respective subgraphs
4. Utilization bars render correctly
5. Graceful fallback if subgraph is unreachable

## Do NOT

- Do NOT introduce React
- Do NOT modify existing panels
- Do NOT change existing API routes
