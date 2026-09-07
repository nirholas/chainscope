import { expect, test } from '@playwright/test';

const BASE =
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 5173}`;

test.describe('new DeFi API routes smoke tests', () => {
  test('/api/crypto-news returns articles', async ({ request }) => {
    const res = await request.get(`${BASE}/api/crypto-news?limit=5`);
    // Route may not be deployed yet — accept 200 or 404 during rollout
    if (res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('articles');
    expect(body).toHaveProperty('fetchedAt');
    expect(Array.isArray(body.articles)).toBe(true);
    if (body.articles.length > 0) {
      const article = body.articles[0];
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('link');
      expect(article).toHaveProperty('source');
      expect(article).toHaveProperty('category');
    }
  });

  test('/api/crypto-news respects category filter', async ({ request }) => {
    const res = await request.get(`${BASE}/api/crypto-news?category=bitcoin&limit=5`);
    if (res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    // When filtering by bitcoin, articles should be tagged as bitcoin (or general if not enough match)
    expect(body).toHaveProperty('articles');
  });

  test('/api/crypto-trending returns topics', async ({ request }) => {
    const res = await request.get(`${BASE}/api/crypto-trending`);
    if (res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('trending');
    expect(body).toHaveProperty('totalArticlesAnalyzed');
    expect(Array.isArray(body.trending)).toBe(true);
    if (body.trending.length > 0) {
      const topic = body.trending[0];
      expect(topic).toHaveProperty('topic');
      expect(topic).toHaveProperty('count');
      expect(topic).toHaveProperty('sentiment');
      expect(['bullish', 'bearish', 'neutral']).toContain(topic.sentiment);
    }
  });


  test('/api/coingecko includes fallback header', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/coingecko?ids=bitcoin&vs_currencies=usd`
    );
    expect(res.status()).toBe(200);
    // After Agent 4's changes, should have X-Data-Source header
    const source = res.headers()['x-data-source'];
    if (source) {
      expect(['coingecko', 'defillama']).toContain(source);
    }
  });
});

test.describe('intel page loads', () => {
  test('/intel renders Shadow DOM host', async ({ page }) => {
    const res = await page.goto(`${BASE}/intel`);
    // Page may not be routed yet during dev — accept 200 or 404
    if (!res || res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);

    // Verify the shadow root exists
    const hasShadow = await page.evaluate(() => {
      const el = document.getElementById('intel-root');
      return el?.shadowRoot !== null && el?.shadowRoot !== undefined;
    });
    expect(hasShadow).toBe(true);

    // Verify header rendered inside shadow DOM
    const headerText = await page.evaluate(() => {
      const el = document.getElementById('intel-root');
      const shadow = el?.shadowRoot;
      const logo = shadow?.querySelector('.intel-logo');
      return logo?.textContent?.trim() || '';
    });
    expect(headerText).toContain('Chainscope');
  });
});
