import { Panel } from './Panel';

interface RobinhoodChainResult {
  timestamp: string;
  chain: { id: number; name: string; explorer: string; rpc: string; rpcFailures: string[] };
  head: { number: number; timestamp: string; txCount: number; gasUsed: number };
  gas: { gasPriceGwei: number; baseFeeGwei: number };
  performance: { blockTimeSec: number | null; tps: number | null };
  dex: {
    uniswapV2Pairs: number;
    uniswapV2Factory: string;
    uniswapV3Factory: string;
    universalRouter: string;
  };
  stablecoin: { symbol: string; address: string; supply: number };
}

/** Compact USD-style magnitude, e.g. 672456374.93 -> "672.5M". */
function compact(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

/** Gas is sub-gwei on this chain, so show enough precision to be meaningful. */
function formatGwei(gwei: number): string {
  if (!Number.isFinite(gwei)) return '-';
  return gwei < 1 ? gwei.toFixed(3) : gwei.toFixed(2);
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Seconds since an ISO timestamp, floored at zero. */
function secondsSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export class RobinhoodChainPanel extends Panel {
  private data: RobinhoodChainResult | null = null;
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({ id: 'robinhood-chain', title: 'Robinhood Chain', showCount: false });
    void this.fetchData();
    // Sub-second blocks, but the route caches for 20s; polling faster only burns quota.
    this.refreshInterval = setInterval(() => this.fetchData(), 20000);
  }

  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    super.destroy();
  }

  private async fetchData(): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      const res = await fetch('/api/robinhood-chain', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.data = await res.json();
      this.error = null;

      const cacheStatus = res.headers.get('X-Cache');
      this.setDataBadge(cacheStatus === 'HIT' || cacheStatus === 'STALE' ? 'cached' : 'live');
      this.setErrorState(false);
    } catch (err) {
      if (signal.aborted) return;
      this.error = err instanceof Error ? err.message : 'Failed to fetch';
      this.setDataBadge('unavailable');
      this.setErrorState(true, this.error);
    } finally {
      if (!signal.aborted) {
        this.loading = false;
        this.renderPanel();
      }
    }
  }

  private renderPanel(): void {
    if (this.loading) {
      this.showLoading('Reading Robinhood Chain...');
      return;
    }
    if (this.error || !this.data) {
      this.showError(this.error || 'No data');
      return;
    }

    const d = this.data;
    const headAge = secondsSince(d.head.timestamp);
    // The head should be seconds old on a sub-second chain; anything more is a stall.
    const headStale = headAge > 60;
    const blockTime = d.performance.blockTimeSec;
    const tps = d.performance.tps;
    const explorerBlock = `${d.chain.explorer}/block/${d.head.number}`;

    const html = `
      <div class="rhc-summary">
        <div class="rhc-stat">
          <span class="rhc-stat-value ${headStale ? 'rhc-warn' : 'rhc-ok'}">${d.head.number.toLocaleString()}</span>
          <span class="rhc-stat-label">Block Height</span>
        </div>
        <div class="rhc-stat">
          <span class="rhc-stat-value">${blockTime != null ? `${blockTime.toFixed(2)}s` : '-'}</span>
          <span class="rhc-stat-label">Block Time</span>
        </div>
        <div class="rhc-stat">
          <span class="rhc-stat-value">${formatGwei(d.gas.gasPriceGwei)}</span>
          <span class="rhc-stat-label">Gas (gwei)</span>
        </div>
        <div class="rhc-stat">
          <span class="rhc-stat-value">${tps != null ? tps.toFixed(0) : '-'}</span>
          <span class="rhc-stat-label">TPS (head)</span>
        </div>
      </div>

      <div class="rhc-rows">
        <div class="rhc-row">
          <span class="rhc-row-label">${d.stablecoin.symbol} supply</span>
          <span class="rhc-row-value">
            <a href="${d.chain.explorer}/token/${d.stablecoin.address}" target="_blank" rel="noopener"
               title="${d.stablecoin.symbol} at ${d.stablecoin.address}">${compact(d.stablecoin.supply)}</a>
          </span>
        </div>
        <div class="rhc-row">
          <span class="rhc-row-label">Uniswap v2 pairs</span>
          <span class="rhc-row-value">
            <a href="${d.chain.explorer}/address/${d.dex.uniswapV2Factory}" target="_blank" rel="noopener"
               title="v2 factory ${shortAddress(d.dex.uniswapV2Factory)}">${d.dex.uniswapV2Pairs.toLocaleString()}</a>
          </span>
        </div>
        <div class="rhc-row">
          <span class="rhc-row-label">Head block txs</span>
          <span class="rhc-row-value">
            <a href="${explorerBlock}" target="_blank" rel="noopener">${d.head.txCount.toLocaleString()}</a>
          </span>
        </div>
        <div class="rhc-row">
          <span class="rhc-row-label">Base fee</span>
          <span class="rhc-row-value">${formatGwei(d.gas.baseFeeGwei)} gwei</span>
        </div>
      </div>

      <div class="rhc-footer">
        <span title="Chain ID ${d.chain.id}">chain ${d.chain.id}</span>
        <span class="${headStale ? 'rhc-warn' : ''}" title="Age of the head block">head ${headAge}s ago</span>
        ${
          d.chain.rpcFailures.length
            ? `<span class="rhc-warn" title="${d.chain.rpcFailures.join(' | ')}">failover +${d.chain.rpcFailures.length}</span>`
            : ''
        }
        <a href="${d.chain.explorer}" target="_blank" rel="noopener">explorer</a>
      </div>
    `;
    this.setContent(html);
  }
}
