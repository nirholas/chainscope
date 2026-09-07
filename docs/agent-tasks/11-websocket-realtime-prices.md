# Agent Task 11: Real-Time WebSocket Price Feeds

## Objective

Replace the polling-based price updates (2-5 min cache TTL) with real-time WebSocket connections for live tick data. This makes the dashboard feel alive — prices update instantly instead of every few minutes.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- Currently all market data is polled via `fetch('/api/coingecko')` etc. with server-side caching
- The MarketPanel and crypto panels show prices that update every 2-5 minutes
- Web Workers exist: `src/workers/analysis.worker.ts` and `src/workers/ml.worker.ts`
- Types in `src/types/index.ts`

## Data Sources

- **Binance WebSocket** (free, no API key):
  - Individual streams: `wss://stream.binance.com:9443/ws/btcusdt@ticker`
  - Combined stream: `wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker`
  - Mini ticker for all: `wss://stream.binance.com:9443/ws/!miniTicker@arr`

- **CoinGecko** doesn't offer free WebSocket — continue using the API for non-Binance tokens

## Architecture

Create a WebSocket service that:
1. Connects to Binance combined stream for top 20 trading pairs
2. Dispatches price update events via `CustomEvent` on `window`
3. Any panel/component can listen for these events to update in real-time
4. Falls back to polling if WebSocket disconnects
5. Runs reconnection logic with exponential backoff

## Files to Create

### 1. `src/services/websocket-prices.ts` — WebSocket Price Service

```typescript
export interface PriceUpdate {
  symbol: string;           // 'BTC', 'ETH', etc.
  pair: string;             // 'BTCUSDT'
  price: number;
  change24h: number;        // Percent
  changeAbsolute: number;   // USD
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface WebSocketPriceConfig {
  pairs: string[];           // ['btcusdt', 'ethusdt', ...]
  onUpdate?: (update: PriceUpdate) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

// Symbol mapping from Binance pair to display symbol
const PAIR_TO_SYMBOL: Record<string, string> = {
  btcusdt: 'BTC', ethusdt: 'ETH', solusdt: 'SOL', bnbusdt: 'BNB',
  xrpusdt: 'XRP', adausdt: 'ADA', dogeusdt: 'DOGE', avaxusdt: 'AVAX',
  dotusdt: 'DOT', maticusdt: 'MATIC', linkusdt: 'LINK', uniusdt: 'UNI',
  aaveusdt: 'AAVE', mkrusdt: 'MKR', shibusdt: 'SHIB', ltcusdt: 'LTC',
  nearusdt: 'NEAR', aptusdt: 'APT', arbusdt: 'ARB', opusdt: 'OP',
};

const DEFAULT_PAIRS = Object.keys(PAIR_TO_SYMBOL);

class WebSocketPriceService {
  private ws: WebSocket | null = null;
  private config: WebSocketPriceConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
  private lastPrices: Map<string, PriceUpdate> = new Map();
  private isDestroyed = false;

  constructor(config?: Partial<WebSocketPriceConfig>) {
    this.config = {
      pairs: config?.pairs || DEFAULT_PAIRS,
      onUpdate: config?.onUpdate,
      onStatusChange: config?.onStatusChange,
    };
  }

  connect(): void {
    if (this.isDestroyed) return;
    
    const streams = this.config.pairs.map(p => `${p}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.config.onStatusChange?.('connected');
        console.log('[WS-Prices] Connected to Binance');
        
        // Dispatch status event
        window.dispatchEvent(new CustomEvent('ws:status', { detail: { status: 'connected' } }));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const data = msg.data;
          if (!data || !data.s) return;
          
          const pair = data.s.toLowerCase();
          const symbol = PAIR_TO_SYMBOL[pair] || data.s;
          
          const update: PriceUpdate = {
            symbol,
            pair: data.s,
            price: parseFloat(data.c),            // Current price
            change24h: parseFloat(data.P),         // Price change percent
            changeAbsolute: parseFloat(data.p),    // Price change absolute
            volume24h: parseFloat(data.v) * parseFloat(data.c), // Volume in USD
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            timestamp: data.E,
          };
          
          this.lastPrices.set(symbol, update);
          
          // Dispatch to any listener
          window.dispatchEvent(new CustomEvent('price:update', { detail: update }));
          this.config.onUpdate?.(update);
        } catch (e) {
          // Ignore parse errors for individual messages
        }
      };
      
      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.status = 'disconnected';
          this.reconnect();
        }
      };
      
      this.ws.onerror = (err) => {
        console.warn('[WS-Prices] Error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.warn('[WS-Prices] Failed to connect:', e);
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    
    this.status = 'reconnecting';
    this.config.onStatusChange?.('reconnecting');
    window.dispatchEvent(new CustomEvent('ws:status', { detail: { status: 'reconnecting' } }));
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`[WS-Prices] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  getLastPrice(symbol: string): PriceUpdate | undefined {
    return this.lastPrices.get(symbol);
  }

  getAllPrices(): Map<string, PriceUpdate> {
    return new Map(this.lastPrices);
  }

  getStatus(): string {
    return this.status;
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.lastPrices.clear();
  }
}

// Singleton instance
let instance: WebSocketPriceService | null = null;

export function getWebSocketPriceService(): WebSocketPriceService {
  if (!instance) {
    instance = new WebSocketPriceService();
  }
  return instance;
}

export function startPriceFeed(): void {
  const service = getWebSocketPriceService();
  service.connect();
}

export function stopPriceFeed(): void {
  instance?.destroy();
  instance = null;
}
```

### 2. Modify `src/App.ts` — Start WebSocket on Init

In the initialization section of App.ts (where services are started), add:

```typescript
import { startPriceFeed } from '@/services/websocket-prices';

// In the init method, after other services start:
startPriceFeed();
```

### 3. Modify `src/components/MarketPanel.ts` — Live Price Updates

Add WebSocket listener to MarketPanel so crypto prices update in real-time:

```typescript
// In constructor or init:
window.addEventListener('price:update', ((e: CustomEvent<PriceUpdate>) => {
  this.handlePriceUpdate(e.detail);
}) as EventListener);

private handlePriceUpdate(update: PriceUpdate): void {
  // Find the matching crypto in the panel's data
  // Update price, change, flash the cell green/red briefly
  const row = this.content.querySelector(`[data-symbol="${update.symbol}"]`);
  if (!row) return;
  
  const priceEl = row.querySelector('.market-price');
  const changeEl = row.querySelector('.market-change');
  if (priceEl) {
    const oldPrice = parseFloat(priceEl.textContent?.replace(/[$,]/g, '') || '0');
    priceEl.textContent = `$${update.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // Flash animation
    const flashClass = update.price > oldPrice ? 'flash-green' : update.price < oldPrice ? 'flash-red' : '';
    if (flashClass) {
      priceEl.classList.add(flashClass);
      setTimeout(() => priceEl.classList.remove(flashClass), 600);
    }
  }
  if (changeEl) {
    changeEl.textContent = `${update.change24h >= 0 ? '+' : ''}${update.change24h.toFixed(2)}%`;
    changeEl.className = `market-change ${update.change24h >= 0 ? 'positive' : 'negative'}`;
  }
}
```

### 4. Modify `src/components/TokenTickerPanel.ts` — Live Ticker Updates

Update the scrolling ticker with real-time prices.

### 5. WebSocket Status Indicator

Add a small connection status indicator somewhere visible (e.g., in the header bar or status area):
- Green dot + "Live" when connected
- Yellow dot + "Reconnecting" when reconnecting  
- Gray dot when disconnected

### 6. CSS Styles for Flash Animations

```css
.flash-green {
  animation: flashGreen 0.6s ease;
}
.flash-red {
  animation: flashRed 0.6s ease;
}
@keyframes flashGreen {
  0% { background-color: rgba(0, 200, 83, 0.3); }
  100% { background-color: transparent; }
}
@keyframes flashRed {
  0% { background-color: rgba(255, 60, 60, 0.3); }
  100% { background-color: transparent; }
}
.ws-status-live { color: #00c853; }
.ws-status-reconnecting { color: #ffd600; }
.ws-status-disconnected { color: rgba(255,255,255,0.3); }
.ws-status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
}
.ws-status-dot.live { background: #00c853; animation: pulse 2s infinite; }
.ws-status-dot.reconnecting { background: #ffd600; animation: pulse 1s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 7. `src/types/index.ts` — Add Types

```typescript
export interface PriceUpdate {
  symbol: string;
  pair: string;
  price: number;
  change24h: number;
  changeAbsolute: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}
```

## Implementation Notes

- The WebSocket connects once and all panels listen via `CustomEvent`
- Debounce DOM updates to avoid excessive re-rendering (Binance sends updates every ~1 second per pair)
- For pairs not on Binance (smaller tokens), keep the existing polling mechanism
- The existing `fetchCrypto()` in `src/services/markets.ts` still works as the initial data source — WebSocket enriches and overrides with real-time data
- Add a `data-symbol` attribute to price elements in panels for efficient targeting
- Handle tab visibility — pause WebSocket when tab is not visible to save bandwidth

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Don't disconnect, but stop processing
  } else {
    // Resume processing
  }
});
```

## Testing

1. `npm run typecheck` passes
2. Prices flash green/red on updates
3. WebSocket reconnects after disconnect
4. Status indicator shows correct connection state
5. Prices match Binance real-time feed
6. Tab visibility pause/resume works
7. No memory leaks (event listeners cleaned up)

## Do NOT

- Do NOT remove existing polling — WebSocket supplements it
- Do NOT introduce React
- Do NOT require any API keys (Binance WS is free)
- Do NOT connect to more than 20 streams (Binance per-connection limit)
