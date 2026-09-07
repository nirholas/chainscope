# Agent Task 10: Historical Time-Series Charts for DeFi Metrics

## Objective

Add historical time-series charts (using d3) to existing DeFi panels that currently only show snapshot data. This transforms static numbers into trend visualizations — critical for understanding momentum and direction.

## Context

- HQ is a vanilla TypeScript app (NO React), Vite 6
- d3 7.9 is already installed and available (`import * as d3 from 'd3'`)
- Several panels already have sparkline patterns (MarketPanel uses 7d sparklines)
- Existing DeFi panels show point-in-time data with no historical context
- API routes are Edge Runtime JavaScript in `api/`

## Scope

Add time-series charts to these 5 existing panels:
1. **ChainTvlPanel** — TVL over time per chain
2. **DexVolumePanel** — DEX volume over time
3. **GlobalStatsPanel** — Total DeFi TVL, stablecoin mcap over time
4. **ProtocolRevenuePanel** — Revenue/fees over time
5. **StablecoinDashboardPanel** — Stablecoin supply over time

## Files to Create / Modify

### 1. `api/historical-tvl.js` — Historical TVL API

```javascript
export const config = { runtime: 'edge' };
```

Fetch from DeFiLlama historical endpoints:
- All DeFi TVL history: `https://api.llama.fi/v2/historicalChainTvl`
- Chain-specific: `https://api.llama.fi/v2/historicalChainTvl/{chain}`
- Protocol-specific: `https://api.llama.fi/protocol/{protocol}`

Support query params for flexibility:
- `?type=total` — total DeFi TVL
- `?type=chain&chain=ethereum` — single chain TVL
- `?type=chains&chains=ethereum,arbitrum,solana` — multiple chains
- `?period=30d` (default) | `90d` | `180d` | `1y`

Response shape:
```json
{
  "timestamp": "...",
  "series": [
    {
      "name": "ethereum",
      "data": [
        { "date": "2024-01-01", "value": 28500000000 },
        { "date": "2024-01-02", "value": 28750000000 }
      ]
    }
  ],
  "period": "30d",
  "summary": {
    "currentTotal": 95000000000,
    "periodStart": 85000000000,
    "percentChange": 11.76,
    "allTimeHigh": 180000000000,
    "allTimeHighDate": "2021-11-09"
  }
}
```

### 2. `api/historical-volume.js` — Historical DEX Volume API

Fetch from DeFiLlama:
- `https://api.llama.fi/overview/dexs?excludeTotalDataChart=false`
- This returns `totalDataChart` with daily volume data

Response shape:
```json
{
  "timestamp": "...",
  "series": [
    {
      "name": "total",
      "data": [{ "date": "2024-01-01", "value": 2500000000 }]
    }
  ],
  "period": "30d"
}
```

### 3. `api/historical-stablecoins.js` — Historical Stablecoin Supply

Fetch from DeFiLlama stablecoins:
- `https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1` (USDT)
- `https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=2` (USDC)

### 4. `src/utils/d3-timeseries.ts` — Reusable D3 Time-Series Chart

Create a reusable chart utility that all panels can use:

```typescript
import * as d3 from 'd3';

export interface TimeSeriesOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  series: Array<{
    name: string;
    data: Array<{ date: string | Date; value: number }>;
    color: string;
  }>;
  yAxisFormat?: 'currency' | 'number' | 'percent';
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  margin?: { top: number; right: number; bottom: number; left: number };
}

export class TimeSeriesChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private options: TimeSeriesOptions;
  private tooltip: HTMLElement | null = null;
  
  constructor(options: TimeSeriesOptions) {
    this.options = {
      width: options.container.clientWidth || 300,
      height: 180,
      yAxisFormat: 'currency',
      showLegend: true,
      showTooltip: true,
      showGrid: true,
      animate: true,
      margin: { top: 10, right: 10, bottom: 25, left: 50 },
      ...options,
    };
    
    this.svg = d3.select(options.container)
      .append('svg')
      .attr('class', 'ts-chart')
      .attr('width', this.options.width!)
      .attr('height', this.options.height!);
    
    this.render();
  }
  
  private render(): void {
    const { width, height, margin, series } = this.options;
    const w = width! - margin!.left - margin!.right;
    const h = height! - margin!.top - margin!.bottom;
    
    const g = this.svg.append('g')
      .attr('transform', `translate(${margin!.left},${margin!.top})`);
    
    // Combine all dates for x scale
    const allDates = series.flatMap(s => s.data.map(d => new Date(d.date)));
    const allValues = series.flatMap(s => s.data.map(d => d.value));
    
    const x = d3.scaleTime()
      .domain(d3.extent(allDates) as [Date, Date])
      .range([0, w]);
    
    const y = d3.scaleLinear()
      .domain([d3.min(allValues)! * 0.95, d3.max(allValues)! * 1.05])
      .range([h, 0]);
    
    // Grid lines
    if (this.options.showGrid) {
      g.append('g').attr('class', 'ts-grid')
        .selectAll('line')
        .data(y.ticks(5))
        .join('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', d => y(d)).attr('y2', d => y(d))
        .attr('stroke', 'rgba(255,255,255,0.06)');
    }
    
    // X axis
    g.append('g').attr('class', 'ts-x-axis')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d') as any))
      .selectAll('text').style('fill', 'rgba(255,255,255,0.5)').style('font-size', '10px');
    
    // Y axis
    const yFormat = this.options.yAxisFormat === 'currency' 
      ? (d: number) => d >= 1e9 ? `$${(d/1e9).toFixed(1)}B` : d >= 1e6 ? `$${(d/1e6).toFixed(0)}M` : `$${d.toFixed(0)}`
      : this.options.yAxisFormat === 'percent'
      ? (d: number) => `${d.toFixed(1)}%`
      : (d: number) => d >= 1e9 ? `${(d/1e9).toFixed(1)}B` : d >= 1e6 ? `${(d/1e6).toFixed(0)}M` : `${d}`;
    
    g.append('g').attr('class', 'ts-y-axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat(yFormat as any))
      .selectAll('text').style('fill', 'rgba(255,255,255,0.5)').style('font-size', '10px');
    
    // Lines for each series
    const line = d3.line<{ date: string | Date; value: number }>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);
    
    series.forEach(s => {
      const path = g.append('path')
        .datum(s.data)
        .attr('class', 'ts-line')
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 1.5)
        .attr('d', line);
      
      if (this.options.animate) {
        const totalLength = (path.node() as SVGPathElement).getTotalLength();
        path.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition().duration(800).ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      }
      
      // Area fill (subtle)
      const area = d3.area<{ date: string | Date; value: number }>()
        .x(d => x(new Date(d.date)))
        .y0(h)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);
      
      g.append('path')
        .datum(s.data)
        .attr('class', 'ts-area')
        .attr('fill', s.color)
        .attr('fill-opacity', 0.08)
        .attr('d', area);
    });
    
    // Legend
    if (this.options.showLegend && series.length > 1) {
      const legend = g.append('g').attr('class', 'ts-legend')
        .attr('transform', `translate(${w - 10}, 5)`);
      
      series.forEach((s, i) => {
        const item = legend.append('g').attr('transform', `translate(0, ${i * 16})`);
        item.append('line').attr('x1', -20).attr('x2', -8).attr('y1', 0).attr('y2', 0).attr('stroke', s.color).attr('stroke-width', 2);
        item.append('text').attr('x', -4).attr('y', 4).text(s.name).style('fill', 'rgba(255,255,255,0.6)').style('font-size', '10px').attr('text-anchor', 'end');
      });
    }
    
    // Tooltip (crosshair on hover)
    if (this.options.showTooltip) {
      this.addTooltip(g, x, y, series, w, h);
    }
  }
  
  private addTooltip(g, x, y, series, w, h): void {
    // Vertical crosshair line + tooltip div showing values at that date
    // Implementation with bisector and mouse events
  }
  
  public update(newSeries: TimeSeriesOptions['series']): void {
    // Re-render with new data
    this.svg.selectAll('*').remove();
    this.options.series = newSeries;
    this.render();
  }
  
  public destroy(): void {
    this.svg.remove();
    this.tooltip?.remove();
  }
  
  public resize(): void {
    const newWidth = this.options.container.clientWidth;
    if (newWidth && newWidth !== this.options.width) {
      this.options.width = newWidth;
      this.svg.attr('width', newWidth);
      this.svg.selectAll('*').remove();
      this.render();
    }
  }
}
```

### 5. Modify Existing Panels — Add Chart Sections

For each of these existing panels, add a time-series chart section:

**a) ChainTvlPanel.ts** — Add a "TVL Trend" expandable section with 30d multi-line chart (top 5 chains by TVL)

**b) DexVolumePanel.ts** — Add "Volume Trend" section with 30d bar/area chart

**c) GlobalStatsPanel.ts** — Add "DeFi TVL History" section with total TVL line chart

**d) ProtocolRevenuePanel.ts** — Add "Revenue Trend" section

**e) StablecoinDashboardPanel.ts** — Add "Supply History" multi-line chart (USDT, USDC, DAI)

For each panel modification:
1. Add a chart container div in the panel's render method
2. Instantiate `TimeSeriesChart` with fetched historical data
3. Add a "period" toggle (7d / 30d / 90d / 1y) above the chart
4. Handle resize with `ResizeObserver`
5. Clean up chart on panel destroy

### 6. CSS Styles for Charts

Add to existing styles or create `src/styles/timeseries.css`:

```css
.ts-chart { display: block; }
.ts-x-axis line, .ts-y-axis line { stroke: rgba(255,255,255,0.1); }
.ts-x-axis path, .ts-y-axis path { stroke: rgba(255,255,255,0.1); }
.ts-grid line { stroke-dasharray: 2,4; }
.ts-chart-container { padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px; }
.ts-period-toggle { display: flex; gap: 4px; margin-bottom: 4px; }
.ts-period-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
.ts-period-btn.active { background: rgba(0,200,83,0.2); border-color: rgba(0,200,83,0.4); color: #00c853; }
```

Import the CSS in `main.ts` or the component files.

## Implementation Strategy

1. First create the `TimeSeriesChart` utility (~150 lines, fully reusable)
2. Create the 3 API routes for historical data
3. Then modify each panel one at a time, adding the chart section
4. Each panel gets a collapsible "Trend" section that lazy-loads historical data only when expanded

## Testing

1. `npm run typecheck` passes
2. Time-series charts render in each modified panel
3. Period toggle (7d/30d/90d) switches chart data correctly
4. Charts resize properly when panel is resized
5. Chart tooltip shows values on hover
6. Historical APIs return valid data with correct date ranges

## Do NOT

- Do NOT introduce React
- Do NOT replace existing panel content — ADD chart sections below existing content
- Do NOT break the existing render logic of any panel
- Do NOT make historical data loading block the panel's initial render (lazy-load charts)
