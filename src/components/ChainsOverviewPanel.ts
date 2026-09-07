import { Panel } from './Panel';

interface ChainRow {
  name: string;
  slug: string;
  chainId: number | null;
  tokenSymbol: string | null;
  tvl: number | null;
  volume24h: number;
  turnover: number | null;
}

interface ChainsOverviewResult {
  timestamp: string;
  totals: { chainCount: number; volume24h: number; tvl: number; turnover: number | null };
  chains: ChainRow[];
}

/** Compact USD magnitude, e.g. 1841311171 -> "$1.84B". */
function usd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Turnover buckets. High turnover means the chain is being traded on rather than
 * used as storage, which is the signal this panel exists to surface.
 */
function turnoverClass(turnover: number | null): string {
  if (turnover == null) return '';
  if (turnover >= 1) return 'chov-hot';
  if (turnover >= 0.25) return 'chov-warm';
  return 'chov-cold';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ChainsOverviewPanel extends Panel {
  private data: ChainsOverviewResult | null = null;
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({ id: 'chains-overview', title: 'Chains Overview', showCount: true });
    void this.fetchData();
    // The route caches for 5 minutes; matching that avoids pointless refetches.
    this.refreshInterval = setInterval(() => this.fetchData(), 300000);
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
      const res = await fetch('/api/chains-overview', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.data = await res.json();
      this.error = null;

      const cacheStatus = res.headers.get('X-Cache');
      this.setDataBadge(cacheStatus === 'HIT' || cacheStatus === 'STALE' ? 'cached' : 'live');
      this.setErrorState(false);
      if (this.data) this.setCount(this.data.totals.chainCount);
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
      this.showLoading('Aggregating chain activity...');
      return;
    }
    if (this.error || !this.data) {
      this.showError(this.error || 'No data');
      return;
    }
    if (!this.data.chains.length) {
      this.setContent(
        `<div class="chov-empty">
           <div class="chov-empty-title">No chain activity reported</div>
           <div class="chov-empty-hint">Upstream returned no chains with volume or TVL. This panel refreshes every 5 minutes.</div>
         </div>`
      );
      return;
    }

    const d = this.data;
    const maxVolume = Math.max(...d.chains.map((c) => c.volume24h), 1);

    const rows = d.chains
      .map((c) => {
        const share = Math.max(2, Math.round((c.volume24h / maxVolume) * 100));
        const turnover = c.turnover != null ? `${c.turnover.toFixed(2)}x` : '-';
        const idTitle = c.chainId != null ? ` (chain ${c.chainId})` : '';
        return `
          <div class="chov-row" title="${escapeHtml(c.name)}${idTitle}: ${usd(c.volume24h)} 24h DEX volume against ${usd(c.tvl)} TVL">
            <span class="chov-name">${escapeHtml(c.name)}</span>
            <span class="chov-bar-wrap"><span class="chov-bar" style="width:${share}%"></span></span>
            <span class="chov-vol">${usd(c.volume24h)}</span>
            <span class="chov-tvl">${usd(c.tvl)}</span>
            <span class="chov-turn ${turnoverClass(c.turnover)}">${turnover}</span>
          </div>`;
      })
      .join('');

    const html = `
      <div class="chov-summary">
        <div class="chov-stat">
          <span class="chov-stat-value">${usd(d.totals.volume24h)}</span>
          <span class="chov-stat-label">24h DEX Volume</span>
        </div>
        <div class="chov-stat">
          <span class="chov-stat-value">${usd(d.totals.tvl)}</span>
          <span class="chov-stat-label">Total TVL</span>
        </div>
        <div class="chov-stat">
          <span class="chov-stat-value ${turnoverClass(d.totals.turnover)}">${
            d.totals.turnover != null ? `${d.totals.turnover.toFixed(2)}x` : '-'
          }</span>
          <span class="chov-stat-label">Turnover</span>
        </div>
      </div>
      <div class="chov-head">
        <span class="chov-name">Chain</span>
        <span class="chov-bar-wrap"></span>
        <span class="chov-vol">Vol 24h</span>
        <span class="chov-tvl">TVL</span>
        <span class="chov-turn" title="24h DEX volume divided by TVL: how hard the chain's capital is working">Turn</span>
      </div>
      <div class="chov-rows">${rows}</div>
    `;
    this.setContent(html);
  }
}
