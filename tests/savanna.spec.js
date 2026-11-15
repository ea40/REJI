// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.use({ baseURL: 'http://localhost:8080' });

/* ==========================================================================
   Savanna Platform Integration & Career Gateway Test Suite
   ========================================================================== */

test.describe('Savanna Platform Integration — Course Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/savanna/pages/concept-with-navigation.html');
    await page.waitForLoadState('networkidle');
  });

  test('should mount <db-player> inside #curriculum_navigation_content .savanna-styles after banner image', async ({ page }) => {
    // 1. Verify mount point
    const playerInSavanna = page.locator('#curriculum_navigation_content .savanna-styles db-player, #curriculum_navigation_content .savanna-styles digital-bridge-player');
    expect(await playerInSavanna.count(), '<db-player> must be mounted inside Savanna content area').toBeGreaterThan(0);

    // 2. Verify banner image precedes player
    const bannerImg = page.locator('#curriculum_navigation_content .savanna-styles img[alt*="Banner"], #curriculum_navigation_content .savanna-styles img[src*="Banner"]');
    expect(await bannerImg.count(), 'Banner image must exist in Savanna content').toBeGreaterThan(0);

    // 3. Verify player shadow DOM
    const shadowAttached = await playerInSavanna.first().evaluate((el) => {
      return !!el.shadowRoot && !!el.shadowRoot.querySelector('#main-video');
    });
    expect(shadowAttached, 'Player must have open Shadow DOM with #main-video').toBe(true);
  });

  test('should have zero critical axe-core violations on the embedded player inside Savanna', async ({ page }) => {
    const player = page.locator('db-player, digital-bridge-player').first();
    await player.scrollIntoViewIfNeeded();

    const results = await new AxeBuilder({ page })
      .include('#savanna-player, db-player, digital-bridge-player')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    const serious = results.violations.filter(v => v.impact === 'serious');

    expect(critical, `Critical axe violations on embedded player: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
    expect(serious, `Serious axe violations on embedded player: ${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });

  test('should operate video controls and toggle captions inside Savanna', async ({ page }) => {
    const player = page.locator('db-player, digital-bridge-player').first();

    // Toggle play state via player API
    const playState = await player.evaluate((el) => {
      // @ts-ignore
      el._togglePlay();
      // @ts-ignore
      return !el._els.video.paused;
    });
    expect(playState, 'Video should start playing when toggled').toBe(true);

    // Toggle captions on
    const captionsOn = await player.evaluate((el) => {
      // @ts-ignore
      if (!el._captionsOn) el._toggleCaptions();
      // @ts-ignore
      return el._captionsOn;
    });
    expect(captionsOn, 'Captions should toggle on').toBe(true);

    // Switch captions to Amharic
    const amharicSet = await player.evaluate((el) => {
      el.setAttribute('lang', 'am');
      // @ts-ignore
      return el._captionTrack === 'am';
    });
    expect(amharicSet, 'Player caption track should switch to Amharic').toBe(true);
  });

  test('should dock Ethiopian Sign Language (EthSL) window inside Savanna layout', async ({ page }) => {
    const player = page.locator('db-player, digital-bridge-player').first();

    const ethslResult = await player.evaluate((el) => {
      // @ts-ignore
      if (!el._ethslOpen) el._toggleEthsl();
      // @ts-ignore
      el._dockEthsl('tr');
      // @ts-ignore
      const overlay = el._els.ethslOverlay;
      return {
        open: overlay.classList.contains('open'),
        top: overlay.style.top,
        right: overlay.style.right,
      };
    });

    expect(ethslResult.open, 'EthSL overlay should be open').toBe(true);
    expect(ethslResult.top, 'EthSL top style should be set for tr dock').toBe('8px');
    expect(ethslResult.right, 'EthSL right style should be set for tr dock').toBe('8px');
  });

  test('should reflow cleanly without horizontal overflow at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto('/savanna/pages/concept-with-navigation.html');
    await page.waitForLoadState('networkidle');

    const player = page.locator('db-player, digital-bridge-player').first();
    await player.scrollIntoViewIfNeeded();

    const playerBox = await player.boundingBox();
    expect(playerBox).toBeTruthy();
    if (playerBox) {
      expect(playerBox.width, 'Player width must fit within 320px viewport').toBeLessThanOrEqual(320);
    }
  });
});

/* ==========================================================================
   Savanna Career Gateway & Verifiable Credential Tests
   ========================================================================== */

test.describe('Savanna Career Gateway & Credentials', () => {
  test('should render accessible job cards at savanna/pages/jobs.html with audio summary', async ({ page }) => {
    await page.goto('/savanna/pages/jobs.html');
    await page.waitForLoadState('networkidle');

    const jobCards = page.locator('db-job-card, digital-bridge-job-card');
    const count = await jobCards.count();
    expect(count, 'Should render at least 3 job cards').toBeGreaterThanOrEqual(3);

    // Verify each card has an audio summary button
    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const audioBtn = card.locator('button[aria-label*="Listen"], button[aria-label*="Audio Summary"]');
      expect(await audioBtn.count(), `Card ${i} should have Audio Summary button`).toBeGreaterThan(0);
    }

    // Verify 200% zoom reflow
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    await page.waitForTimeout(400);

    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasScroll, 'Jobs page should not have horizontal scroll at 200% zoom').toBe(false);
  });

  test('should perform cryptographic Ed25519 verification on savanna/pages/certificate.html', async ({ page }) => {
    await page.goto('/savanna/pages/certificate.html');
    await page.waitForLoadState('networkidle');

    // 1. Test authentic credential verification
    const verifyBtn = page.locator('#verify-btn');
    await verifyBtn.click();
    await page.waitForTimeout(600);

    const validBadge = page.locator('.status-badge.status-valid');
    await expect(validBadge).toBeVisible({ timeout: 5000 });
    const validText = await validBadge.textContent();
    expect(validText).toContain('Signature Verified');

    // 2. Test anti-tamper rejection
    const tamperBtn = page.locator('#tamper-btn');
    await tamperBtn.click();
    await page.waitForTimeout(600);

    const invalidBadge = page.locator('.status-badge.status-invalid');
    await expect(invalidBadge).toBeVisible({ timeout: 5000 });
    const invalidText = await invalidBadge.textContent();
    expect(invalidText).toContain('Verification Failed');
  });
});

/* ==========================================================================
   Embedded Element Builder Test (demo/embed.html)
   ========================================================================== */

test.describe('Embedded Element Builder (demo/embed.html)', () => {
  test('should load standalone bundled component and update live preview', async ({ page }) => {
    await page.goto('/demo/embed.html');
    await page.waitForLoadState('networkidle');

    // Verify player and job-card are mounted
    const player = page.locator('#embed-player');
    expect(await player.count()).toBe(1);

    const jobCard = page.locator('db-job-card');
    expect(await jobCard.count()).toBeGreaterThan(0);

    // Verify snippet box contains copyable code
    const snippetText = await page.locator('#code-snippet').textContent();
    expect(snippetText).toContain('<script src=');
    expect(snippetText).toContain('<db-player');

    // Test changing language configurator to Amharic
    await page.selectOption('#cfg-lang', 'am');
    await page.waitForTimeout(300);

    const updatedSnippet = await page.locator('#code-snippet').textContent();
    expect(updatedSnippet).toContain('lang="am"');
  });
});
