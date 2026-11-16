// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/* ==========================================================================
   Spoken navigation (TTS layer)
   - shortcuts read event.code, so a non-Latin key value (Amharic) still works
   - every route to speech and to the key guide works without Alt+Shift
   - WCAG 2.1.4 letter-key switch, first-visit notice, focus not obscured
   ========================================================================== */

const ready = async (page) => {
  await page.waitForFunction(() => !!window.DBTtsNav && !!document.getElementById('dbt-tts-toggle'));
};

const key = (page, init) => page.evaluate((opts) => {
  document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, opts)));
}, init);

const status = (page) => page.evaluate(() => window.DBTtsNav.status());

test.describe('Spoken navigation — keyboard routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  });

  test('letter navigation uses event.code, not the Ethiopic key value', async ({ page }) => {
    await key(page, { code: 'KeyH', key: 'ሀ' });
    await expect(page.locator('h1')).toBeFocused();
    await key(page, { code: 'KeyH', key: 'ሀ' });
    const heading = await page.evaluate(() => (document.activeElement.textContent || '').trim());
    expect(heading).toBe('Use cases');
  });

  test('D jumps between regions with an Ethiopic key value', async ({ page }) => {
    await key(page, { code: 'KeyD', key: 'ድ' });
    const tag = await page.evaluate(() => document.activeElement.tagName);
    expect(['MAIN', 'HEADER', 'NAV', 'SECTION', 'ASIDE', 'FOOTER', 'DIV']).toContain(tag);
  });

  test('composing input is ignored', async ({ page }) => {
    const before = await page.evaluate(() => document.activeElement.tagName);
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'ሀ', isComposing: true, bubbles: true }));
    });
    const after = await page.evaluate(() => document.activeElement.tagName);
    expect(after).toBe(before);
  });
});

test.describe('Spoken navigation — routes that never need Alt+Shift', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
  });

  test('visible "Keys and speech" control is the first tab stop and opens the guide', async ({ page }) => {
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Tab');
    const firstId = await page.evaluate(() => document.activeElement.id);
    expect(firstId).toBe('dbt-tts-firststop');

    await page.keyboard.press('Enter');
    await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);
  });

  test('"?" opens the guide', async ({ page }) => {
    await key(page, { code: 'Slash', key: '?', shiftKey: true });
    await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);
  });

  test('leader sequence G then K opens the guide, G then S toggles speech', async ({ page }) => {
    await key(page, { code: 'KeyG', key: 'g' });
    await key(page, { code: 'KeyK', key: 'k' });
    await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);
    await page.keyboard.press('Escape');

    const before = await status(page);
    expect(before.enabled).toBe(true);
    await key(page, { code: 'KeyG', key: 'g' });
    await key(page, { code: 'KeyS', key: 's' });
    expect((await status(page)).enabled).toBe(false);
    await key(page, { code: 'KeyG', key: 'g' });
    await key(page, { code: 'KeyS', key: 's' });
    expect((await status(page)).enabled).toBe(true);
  });

  test('panel Speech button and legacy Alt+Shift+T both toggle speech', async ({ page }) => {
    await page.locator('#dbt-tts-toggle').click();
    expect((await status(page)).enabled).toBe(false);
    await page.locator('#dbt-tts-toggle').click();
    expect((await status(page)).enabled).toBe(true);

    await key(page, { code: 'KeyT', key: 'T', altKey: true, shiftKey: true });
    expect((await status(page)).enabled).toBe(false);
  });

  test('Escape stops speech and closes the guide', async ({ page }) => {
    await page.locator('#dbt-tts-firststop').click();
    await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dbt-tts-guide')).not.toHaveJSProperty('open', true);
    await expect(page.locator('#dbt-tts-firststop')).toBeFocused();
    const speaking = await page.evaluate(() => window.DBSpeech ? window.DBSpeech.isSpeaking('ui') : false);
    expect(speaking).toBe(false);
  });
});

test.describe('Spoken navigation — WCAG 2.1.4 letter-key switch', () => {
  test('turning letter keys off disables them and persists across pages', async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);

    await page.locator('#dbt-tts-letters').click();
    expect((await status(page)).letterKeys).toBe(false);

    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    const before = await page.evaluate(() => document.activeElement.tagName);
    await key(page, { code: 'KeyH', key: 'ሀ' });
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe(before);

    await page.reload();
    await ready(page);
    expect((await status(page)).letterKeys).toBe(false);

    // The Tab route still works with letter keys off.
    await page.locator('#dbt-tts-firststop').click();
    await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);
  });
});

test.describe('Spoken navigation — first-visit screen-reader notice', () => {
  test('notice is keyboard reachable and the screen-reader choice silences the layer', async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
    await expect(page.locator('#dbt-tts-notice')).toBeVisible();

    await page.locator('#dbt-notice-sr').click();
    const after = await status(page);
    expect(after.enabled).toBe(false);
    expect(after.letterKeys).toBe(false);
    await expect(page.locator('#dbt-tts-notice')).toHaveCount(0);

    await page.reload();
    await ready(page);
    await expect(page.locator('#dbt-tts-notice')).toHaveCount(0);
    const persisted = await status(page);
    expect(persisted.enabled).toBe(false);
    expect(persisted.letterKeys).toBe(false);
  });

  test('keeping speech on dismisses the notice and records the visit', async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
    await page.locator('#dbt-notice-keep').click();
    await expect(page.locator('#dbt-tts-notice')).toHaveCount(0);
    expect((await status(page)).enabled).toBe(true);
    await page.reload();
    await ready(page);
    await expect(page.locator('#dbt-tts-notice')).toHaveCount(0);
  });
});

test.describe('Spoken navigation — WCAG 2.2 gate', () => {
  for (const url of ['/index.html', '/demo.html']) {
    test(`no critical or serious axe issues with panel and guide — ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await ready(page);

      const closed = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      const closedBad = closed.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      expect(closedBad, JSON.stringify(closedBad, null, 2)).toHaveLength(0);

      await page.locator('#dbt-tts-firststop').click();
      await expect(page.locator('#dbt-tts-guide')).toHaveJSProperty('open', true);

      const open = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      const openBad = open.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      expect(openBad, JSON.stringify(openBad, null, 2)).toHaveLength(0);
    });
  }

  test('fixed panel does not obscure the focused element at 320px and 200% zoom', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/index.html');
    await ready(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await key(page, { code: 'KeyH', key: 'ሀ' });

    const result = await page.evaluate(() => {
      const el = document.activeElement;
      const panel = document.querySelector('.dbt-panel');
      const a = el.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      const overlaps = !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
      return {
        overlaps,
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        panelWidth: Math.round(b.width),
        viewport: window.innerWidth
      };
    });

    expect(result.overlaps, 'Panel must not cover the focused element').toBe(false);
    expect(result.horizontalScroll, 'Panel must not break reflow').toBe(false);
    expect(result.panelWidth).toBeLessThanOrEqual(result.viewport);
  });

  test('guide dialog traps focus, closes with Escape and returns focus', async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
    await page.locator('#dbt-tts-firststop').click();

    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
    }
    const insideDialog = await page.evaluate(() => {
      const dialog = document.getElementById('dbt-tts-guide');
      return !!(dialog && dialog.contains(document.activeElement));
    });
    expect(insideDialog, 'Tab must stay inside the open guide').toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#dbt-tts-guide')).not.toHaveJSProperty('open', true);
    await expect(page.locator('#dbt-tts-firststop')).toBeFocused();
  });
});
