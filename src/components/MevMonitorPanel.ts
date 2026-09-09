import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { MevMonitorResult, MevBlock, MevBuilderShare } from '@/types';

/* ── Helpers ── */

const BUILDER_COLORS: Record<string, string> = {
  beaverbuild: '#f59e0b',
  'Titan Builder': '#8b5cf6',
  Titan: '#8b5cf6',
  rsync: '#10b981',
  flashbots: '#3b82f6',
  bloxroute: '#ef4444',
  'builder0x69': '#ec4899',
  buildAI: '#06b6d4',
};

function builderColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(BUILDER_COLORS)) {
    if (lower.includes(key.toLowerCase())) return color;
  }
  // Deterministic fallback colour from name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function mevColor(usd: number): string {
  if (usd < 500) return '#4caf50';   // green – low
  if (usd < 2000) return '#f59e0b';  // amber – medium
  return '#ef4444';                   // red – high
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatETH(n: number): string {
  return `${n.toFixed(4)} ETH`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/* ── Panel ── */

export class MevMonitorPanel extends Panel {
  private data: MevMonitorResult | null = null;
  private loading = true;
  private error: string | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    super({
      id: 'mev-monitor',
      title: 'MEV Monitor',
      showCount: true,
      infoTooltip:
        'Tracks MEV extraction, sandwich attacks, and block builder competition on Ethereum',
    });
    void this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 60_000); // 1 min
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

  /* ── Data fetching ── */

  private async fetchData(): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      const res = await fetch('/api/mev-monitor', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MevMonitorResult = await res.json();
      this.data = json;
      this.error = null;
    } catch (err) {
      if (signal.aborted) return;
      this.error = err instanceof Error ? err.message : 'Failed to fetch';
    } finally {
      this.loading = false;
      this.renderPanel();
    }
  }

  /* ── Render ── */

  private renderPanel(): void {
    if (this.loading) {
      this.showLoading('Loading MEV data...');
      return;
    }
    if (this.error || !this.data) {
      this.showError(this.error || 'No MEV data available');
      return;
    }

    const d = this.data;
    this.setDataBadge('live');
    if (d.window.payloadCount > 0) this.setCount(d.window.payloadCount);

    const html = `
      <div class="mev-container">
        ${this.renderStats(d)}
        ${this.renderBuilderShare(d.builderShare)}
        ${this.renderRecentBlocks(d.blocks)}
        ${this.renderSource(d)}
      </div>
    `;
    this.setContent(html);
  }

  /* ── Section 1: Stats Overview ── */

  private renderStats(d: MevMonitorResult): string {
    const s = d.stats;
    const hours = d.window.seconds / 3600;
    const usd = (value: number | null) => (value == null ? 'n/a' : formatUSD(value));
    return `
      <div class="mev-stats-grid">
        <div class="mev-stat-card">
          <span class="mev-stat-value">${escapeHtml(usd(s.totalProposerPaymentUSD))}</span>
          <span class="mev-stat-label" title="Total paid to proposers across the sampled payloads">Paid to Proposers (${hours.toFixed(0)}h)</span>
        </div>
        <div class="mev-stat-card">
          <span class="mev-stat-value">${escapeHtml(formatETH(s.avgProposerPaymentEth))}</span>
          <span class="mev-stat-label">Avg / Block</span>
        </div>
        <div class="mev-stat-card">
          <span class="mev-stat-value">${d.window.payloadCount.toLocaleString()}</span>
          <span class="mev-stat-label">Payloads Sampled</span>
        </div>
        <div class="mev-stat-card">
          <span class="mev-stat-value mev-arb-accent">${s.builderDominance.toFixed(1)}%</span>
          <span class="mev-stat-label" title="Share of sampled blocks built by the top builder">Top Builder Share</span>
        </div>
      </div>
    `;
  }

  /* ── Section 2: Builder Market Share ── */

  private renderBuilderShare(builders: MevBuilderShare[]): string {
    if (!builders || builders.length === 0) return '';

    const rows = builders
      .slice(0, 8)
      .map((b) => {
        const color = builderColor(b.name);
        return `
        <div class="mev-builder-bar">
          <div class="mev-builder-label">
            <span class="mev-builder-dot" style="background:${color}"></span>
            <span>${escapeHtml(b.name)}</span>
          </div>
          <div class="mev-builder-track">
            <div class="mev-builder-fill" style="width:${Math.min(b.share, 100)}%;background:${color}"></div>
          </div>
          <span class="mev-builder-pct">${b.share.toFixed(1)}%</span>
        </div>`;
      })
      .join('');

    return `
      <div class="mev-section">
        <div class="mev-section-title">Block Builder Market Share</div>
        ${rows}
      </div>
    `;
  }

  /* ── Section 3: Recent MEV Blocks ── */

  private renderRecentBlocks(blocks: MevBlock[]): string {
    if (!blocks || blocks.length === 0) {
      return `
        <div class="mev-section">
          <div class="mev-section-title">Recent Delivered Blocks</div>
          <div class="mev-empty">The relay reported no delivered payloads in this window.</div>
        </div>
      `;
    }

    const rows = blocks
      .slice(0, 10)
      .map(
        (b, i) => `
      <div class="mev-block-row${i % 2 === 0 ? ' mev-block-even' : ''}">
        <a class="mev-block-num" href="https://etherscan.io/block/${b.blockNumber}" target="_blank" rel="noopener noreferrer">#${b.blockNumber.toLocaleString()}</a>
        <span class="mev-block-reward"${b.proposerPaymentUSD != null ? ` style="color:${mevColor(b.proposerPaymentUSD)}"` : ''}>${escapeHtml(formatETH(b.proposerPaymentEth))}</span>
        <span class="mev-block-builder" title="${escapeHtml(b.builderPubkey)}">${escapeHtml(b.builderName)}</span>
        <span class="mev-block-meta">${b.txCount.toLocaleString()} tx</span>
        <span class="mev-block-time">${timeAgo(b.timestamp)}</span>
      </div>`,
      )
      .join('');

    return `
      <div class="mev-section">
        <div class="mev-section-title">Recent Delivered Blocks</div>
        <div class="mev-block-list">${rows}</div>
      </div>
    `;
  }

  /* ── Section 4: Where these numbers come from ── */

  private renderSource(d: MevMonitorResult): string {
    const priceNote = d.source.ethPriceUnavailable
      ? 'USD figures unavailable: no price lane answered.'
      : `ETH at ${formatUSD(d.source.ethPriceUSD ?? 0)}.`;
    return `
      <div class="mev-section mev-source">
        <div class="mev-source-line">Relay: ${escapeHtml(d.source.relay)}. ${escapeHtml(priceNote)}</div>
        <div class="mev-source-note">${escapeHtml(d.source.note)}</div>
        ${
          d.source.relayFailures.length
            ? `<div class="mev-source-note" title="${escapeHtml(d.source.relayFailures.join(' | '))}">Failed over past ${d.source.relayFailures.length} relay(s).</div>`
            : ''
        }
      </div>
    `;
  }
}
