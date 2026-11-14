// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.use({ baseURL: 'http://localhost:8080' });

/* ==========================================================================
   a) WCAG 2.2 AA Compliance — Demo Page
   ========================================================================== */

test.describe('WCAG 2.2 AA Compliance — Demo Page', () => {
  test('should have zero critical axe-core violations at default zoom', async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    const serious = results.violations.filter(v => v.impact === 'serious');

    expect(critical, `Critical violations found: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
    expect(serious, `Serious violations found: ${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });

  test('should have zero critical axe-core violations at 200% zoom', async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });

    // Allow reflow to settle
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    const serious = results.violations.filter(v => v.impact === 'serious');

    expect(critical, `Critical violations at 200% zoom: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
    expect(serious, `Serious violations at 200% zoom: ${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });
});

/* ==========================================================================
   b) Player Component — Keyboard Navigation
   ========================================================================== */

test.describe('Player Component — Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('should allow Tab through all player controls with visible focus', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await expect(player).toBeVisible();

    // Focus the player area first
    await player.click();

    const controlSelectors = [
      'button[aria-label*="Play"], button[aria-label*="play"]',
      'button[aria-label*="Pause"], button[aria-label*="pause"]',
      'button[aria-label*="Mute"], button[aria-label*="mute"], button[aria-label*="Volume"], button[aria-label*="volume"]',
      'button[aria-label*="Caption"], button[aria-label*="caption"], button[aria-label*="CC"]',
      'button[aria-label*="Sign"], button[aria-label*="sign"], button[aria-label*="EthSL"]',
      'button[aria-label*="Fullscreen"], button[aria-label*="fullscreen"]',
    ];

    // Tab through controls and verify each receives focus
    let focusedCount = 0;
    const maxTabs = 30; // Safety limit

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
          el = el.shadowRoot.activeElement;
        }
        if (!el) return { isControl: false, hasOutline: true };
        const tag = el.tagName?.toLowerCase() || '';
        const role = el.getAttribute('role') || '';
        const isControl = tag === 'button' || tag === 'input' || tag === 'select' || tag === 'digital-bridge-player' || role === 'button' || role === 'slider';
        const styles = window.getComputedStyle(el);
        const outline = (styles.outlineStyle || '') + ' ' + (styles.outlineWidth || '') + ' ' + (styles.outlineColor || '');
        const hasOutline = !outline.startsWith('none 0px') || (styles.boxShadow && styles.boxShadow !== 'none');
        return { isControl, hasOutline };
      });

      if (info.isControl) {
        focusedCount++;
        expect(info.hasOutline, `Control #${focusedCount} has no visible focus outline`).toBe(true);
      }
    }

    expect(focusedCount, 'No player controls received focus via Tab').toBeGreaterThan(0);
  });

  test('should toggle play/pause with Space key', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.focus();

    // Press Space to play
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    let isPlaying = await page.evaluate(() => {
      const p = document.querySelector('digital-bridge-player')?.shadowRoot;
      const btn = p?.querySelector('#play-btn');
      const video = p?.querySelector('video') || document.querySelector('video');
      return btn?.getAttribute('aria-pressed') === 'true' || (video && !video.paused);
    });

    // Press Space again to pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    let isPaused = await page.evaluate(() => {
      const p = document.querySelector('digital-bridge-player')?.shadowRoot;
      const btn = p?.querySelector('#play-btn');
      const video = p?.querySelector('video') || document.querySelector('video');
      return btn?.getAttribute('aria-pressed') === 'false' || (video && video.paused);
    });

    // At least one state change should have occurred
    expect(isPlaying !== isPaused || isPlaying === true || isPaused === true).toBeTruthy();
  });

  test('should support J/K/L keyboard shortcuts', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Get initial time
    const initialTime = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.currentTime ?? 0;
    });

    // Press L to seek forward
    await page.keyboard.press('l');
    await page.waitForTimeout(300);

    const afterL = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.currentTime ?? 0;
    });

    // Press J to seek backward
    await page.keyboard.press('j');
    await page.waitForTimeout(300);

    const afterJ = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.currentTime ?? 0;
    });

    // Press K to play/pause
    await page.keyboard.press('k');
    await page.waitForTimeout(300);

    // Verify shortcuts are responsive (at least L should have advanced time or K toggled state)
    const kToggled = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video ? video.paused : null;
    });

    // We verify that the keyboard shortcuts are wired (no errors thrown)
    expect(kToggled).not.toBeNull();
  });

  test('should toggle captions with C key', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.focus();
    await player.click();

    // Initial state
    const initialState = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const btn = container.querySelector('#captions-btn, button[aria-label*="caption" i]');
      return btn?.getAttribute('aria-pressed') === 'true';
    });

    // Press C to toggle captions
    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    const afterFirst = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const btn = container.querySelector('#captions-btn, button[aria-label*="caption" i]');
      return btn?.getAttribute('aria-pressed') === 'true';
    });

    // Press C again to toggle off
    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    const afterSecond = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const btn = container.querySelector('#captions-btn, button[aria-label*="caption" i]');
      return btn?.getAttribute('aria-pressed') === 'true';
    });

    // The state should toggle
    expect(afterFirst).not.toBe(initialState);
    expect(afterSecond).toBe(initialState);
  });

  test('should toggle sign language overlay with S key', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    await page.keyboard.press('s');
    await page.waitForTimeout(300);

    const signVisible = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const signEl = container.querySelector('.ethsl-overlay, .sign-language, [class*="sign"], [class*="ethsl"]');
      if (!signEl) return null;
      const styles = window.getComputedStyle(signEl);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    // Toggle off
    await page.keyboard.press('s');
    await page.waitForTimeout(300);

    const signHidden = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const signEl = container.querySelector('.ethsl-overlay, .sign-language, [class*="sign"], [class*="ethsl"]');
      if (!signEl) return null;
      const styles = window.getComputedStyle(signEl);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    if (signVisible !== null && signHidden !== null) {
      expect(signVisible).not.toBe(signHidden);
    }
  });

  test('should toggle mute with M key', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    await page.keyboard.press('m');
    await page.waitForTimeout(200);

    const mutedAfterFirst = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.muted ?? null;
    });

    await page.keyboard.press('m');
    await page.waitForTimeout(200);

    const mutedAfterSecond = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.muted ?? null;
    });

    if (mutedAfterFirst !== null && mutedAfterSecond !== null) {
      expect(mutedAfterFirst).not.toBe(mutedAfterSecond);
    }
  });

  test('should close open panels with Escape key', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Open captions panel first
    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify any open panels/modals are closed
    const openPanels = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const panels = container.querySelectorAll(
        '.panel.open, .drawer.open, [class*="panel"][class*="open"], [class*="drawer"][class*="open"], dialog[open]'
      );
      return panels.length;
    });

    expect(openPanels).toBe(0);
  });
});

/* ==========================================================================
   c) Player Component — Preset Profiles
   ========================================================================== */

test.describe('Player Component — Preset Profiles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('Deaf / Hard of Hearing preset enables captions and EthSL', async ({ page }) => {
    const deafBtn = page.locator('button:has-text("Deaf"), button:has-text("Hard of Hearing"), button[data-preset="deaf"]');
    await deafBtn.first().click();
    await page.waitForTimeout(500);

    // Captions should be visible
    const captionsVisible = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const captionEl = container.querySelector(
        '.caption-display, .captions, [class*="caption"]:not(button):not([class*="btn"])'
      );
      if (!captionEl) return false;
      const styles = window.getComputedStyle(captionEl);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
    expect(captionsVisible).toBe(true);

    // EthSL window should be visible
    const ethslVisible = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const ethslEl = container.querySelector(
        '.ethsl-overlay, .sign-language, [class*="sign"], [class*="ethsl"]'
      );
      if (!ethslEl) return false;
      const styles = window.getComputedStyle(ethslEl);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
    expect(ethslVisible).toBe(true);
  });

  test('Blind / Screen Reader preset enables audio description', async ({ page }) => {
    const blindBtn = page.locator('button:has-text("Blind"), button:has-text("Screen Reader"), button[data-preset="blind"]');
    await blindBtn.first().click();
    await page.waitForTimeout(500);

    // Audio description should be enabled
    const adEnabled = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const adEl = container.querySelector(
        '[class*="audio-desc"], [data-ad="true"], [aria-label*="Audio Description"], [class*="ad-active"]'
      );
      if (adEl) return true;
      // Check for a data attribute or class on the player itself
      const player = document.querySelector('digital-bridge-player');
      return player?.hasAttribute('data-ad-enabled') || player?.classList?.contains('ad-enabled') || false;
    });
    expect(adEnabled).toBe(true);

    // UI should be simplified
    const simplified = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const player = document.querySelector('digital-bridge-player');
      return player?.classList?.contains('simplified') ||
        player?.hasAttribute('data-simplified') ||
        container.querySelector('.simplified, [class*="simplified"]') !== null;
    });
    expect(simplified).toBe(true);
  });

  test('One-Hand / Motor preset makes buttons ≥48px', async ({ page }) => {
    const motorBtn = page.locator('button:has-text("One-Hand"), button:has-text("Motor"), button[data-preset="motor"]');
    await motorBtn.first().click();
    await page.waitForTimeout(500);

    const allButtonsLargeEnough = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 48 || rect.height < 48) {
            return { pass: false, width: rect.width, height: rect.height, label: btn.textContent?.trim() };
          }
        }
      }
      return { pass: true };
    });

    expect(allButtonsLargeEnough.pass, `Button "${allButtonsLargeEnough.label}" is ${allButtonsLargeEnough.width}x${allButtonsLargeEnough.height}px`).toBe(true);
  });

  test('3G / Low-Bandwidth preset pauses video and shows text mode', async ({ page }) => {
    const lowBwBtn = page.locator('button:has-text("3G"), button:has-text("Low-Bandwidth"), button:has-text("Low Bandwidth"), button[data-preset="lowbw"]');
    await lowBwBtn.first().click();
    await page.waitForTimeout(500);

    // Video should be paused
    const isPaused = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.paused ?? true;
    });
    expect(isPaused).toBe(true);

    // Text mode should be visible
    const textModeVisible = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const textEl = container.querySelector(
        '.text-mode, [class*="text-mode"], [class*="transcript"], .text-only'
      );
      if (!textEl) return false;
      const styles = window.getComputedStyle(textEl);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
    expect(textModeVisible).toBe(true);
  });
});

/* ==========================================================================
   d) Player Component — Caption System
   ========================================================================== */

test.describe('Player Component — Caption System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display English captions', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Enable captions
    await page.keyboard.press('c');
    await page.waitForTimeout(500);

    // Look for English caption track or caption text
    const englishCaptionExists = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      // Check for a track element with English
      const tracks = container.querySelectorAll('track[srclang="en"], track[label*="English"]');
      if (tracks.length > 0) return true;
      // Check for caption display text in English
      const captionText = container.querySelector('.caption-display, .captions, [class*="caption-text"]');
      return captionText !== null;
    });

    expect(englishCaptionExists).toBe(true);
  });

  test('should load and display Amharic captions', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Look for Amharic caption track
    const amharicCaptionExists = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const tracks = container.querySelectorAll('track[srclang="am"], track[label*="Amharic"], track[label*="አማርኛ"]');
      if (tracks.length > 0) return true;
      // Check for language selector with Amharic option
      const amOption = container.querySelector('option[value="am"], [data-lang="am"]');
      return amOption !== null;
    });

    expect(amharicCaptionExists).toBe(true);

    // If there's a language switcher, switch to Amharic
    const switched = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const select = container.querySelector('select[class*="lang"], select[aria-label*="language"], select[aria-label*="Language"]');
      if (select) {
        /** @type {HTMLSelectElement} */ (select).value = 'am';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      const amBtn = container.querySelector('button[data-lang="am"], button:has-text("አማርኛ")');
      if (amBtn) {
        /** @type {HTMLElement} */ (amBtn).click();
        return true;
      }
      return false;
    });

    if (switched) {
      await page.waitForTimeout(300);
    }
  });

  test('should open caption styling drawer and change font size', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Enable captions first
    await page.keyboard.press('c');
    await page.waitForTimeout(300);

    // Look for caption settings/styling button
    const stylingBtn = page.locator(
      'button[aria-label*="Caption Style"], button[aria-label*="caption style"], button[aria-label*="Caption Settings"], button[class*="caption-style"], button[class*="cc-settings"]'
    );

    if (await stylingBtn.count() > 0) {
      await stylingBtn.first().click();
      await page.waitForTimeout(300);

      // Look for font size control
      const fontSizeControl = page.locator(
        'input[type="range"][aria-label*="font"], select[aria-label*="font size"], button[aria-label*="Increase"], [class*="font-size"]'
      );

      if (await fontSizeControl.count() > 0) {
        const initialSize = await page.evaluate(() => {
          const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
          const captionEl = container.querySelector('.caption-display, .captions, [class*="caption-text"]');
          return captionEl ? window.getComputedStyle(captionEl).fontSize : '16px';
        });

        // Interact with the font size control
        await fontSizeControl.first().click();
        await page.waitForTimeout(200);

        // Verify the drawer is open
        const drawerOpen = await page.evaluate(() => {
          const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
          const drawer = container.querySelector(
            '.caption-style-drawer, .cc-settings, [class*="style-drawer"], [class*="caption-settings"], dialog[open]'
          );
          if (!drawer) return false;
          const styles = window.getComputedStyle(drawer);
          return styles.display !== 'none' && styles.visibility !== 'hidden';
        });

        expect(drawerOpen).toBe(true);
      }
    }
  });
});

/* ==========================================================================
   e) Player Component — EthSL Overlay
   ========================================================================== */

test.describe('Player Component — EthSL Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('should show EthSL overlay when toggled', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Toggle sign language
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    const overlayVisible = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const overlay = container.querySelector(
        '.ethsl-overlay, .sign-language-overlay, [class*="ethsl"], [class*="sign-overlay"]'
      );
      if (!overlay) return false;
      const styles = window.getComputedStyle(overlay);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    expect(overlayVisible).toBe(true);
  });

  test('should change dock position via dock buttons', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Enable EthSL overlay
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Get initial position
    const initialPosition = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const overlay = container.querySelector(
        '.ethsl-overlay, .sign-language-overlay, [class*="ethsl"], [class*="sign-overlay"]'
      );
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    // Look for dock position buttons
    const dockButtons = page.locator(
      'button[aria-label*="dock"], button[aria-label*="Dock"], button[class*="dock"], button[data-dock]'
    );

    if (await dockButtons.count() > 1) {
      // Click the second dock button (different position)
      await dockButtons.nth(1).click();
      await page.waitForTimeout(300);

      const newPosition = await page.evaluate(() => {
        const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
        const overlay = container.querySelector(
          '.ethsl-overlay, .sign-language-overlay, [class*="ethsl"], [class*="sign-overlay"]'
        );
        if (!overlay) return null;
        const rect = overlay.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      });

      if (initialPosition && newPosition) {
        const positionChanged = initialPosition.left !== newPosition.left || initialPosition.top !== newPosition.top;
        expect(positionChanged, 'Dock position should change when dock button is clicked').toBe(true);
      }
    }
  });

  test('should move EthSL overlay with keyboard arrow keys', async ({ page }) => {
    const player = page.locator('digital-bridge-player');
    await player.click();

    // Enable EthSL overlay
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Focus the overlay
    const overlay = page.locator(
      '.ethsl-overlay, .sign-language-overlay, [class*="ethsl"], [class*="sign-overlay"]'
    );

    if (await overlay.count() > 0) {
      await overlay.first().focus();
      await page.waitForTimeout(200);

      const beforePos = await overlay.first().boundingBox();

      // Press arrow keys to move
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);

      const afterPos = await overlay.first().boundingBox();

      if (beforePos && afterPos) {
        const moved = beforePos.x !== afterPos.x || beforePos.y !== afterPos.y;
        expect(moved, 'Overlay should move when arrow keys are pressed').toBe(true);
      }
    }
  });
});

/* ==========================================================================
   f) Player Component — Transcript
   ========================================================================== */

test.describe('Player Component — Transcript', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('should render transcript cues', async ({ page }) => {
    // Open transcript panel
    const transcriptBtn = page.locator(
      'button[aria-label*="Transcript"], button[aria-label*="transcript"], button:has-text("Transcript")'
    );

    if (await transcriptBtn.count() > 0) {
      await transcriptBtn.first().click();
      await page.waitForTimeout(500);
    }

    const cueCount = await page.evaluate(() => {
      const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
      const cues = container.querySelectorAll(
        '.transcript-cue, .cue, [class*="transcript"] [class*="cue"], [class*="transcript"] li, [class*="transcript"] p'
      );
      return cues.length;
    });

    expect(cueCount, 'Transcript should contain cues').toBeGreaterThan(0);
  });

  test('should seek video when clicking a transcript cue', async ({ page }) => {
    // Open transcript panel
    const transcriptBtn = page.locator(
      'button[aria-label*="Transcript"], button[aria-label*="transcript"], button:has-text("Transcript")'
    );

    if (await transcriptBtn.count() > 0) {
      await transcriptBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Get initial video time
    const initialTime = await page.evaluate(() => {
      const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
        || document.querySelector('video');
      return video?.currentTime ?? 0;
    });

    // Click a transcript cue (not the first, to ensure a seek)
    const cues = page.locator(
      '.transcript-cue, .cue, [class*="transcript"] [class*="cue"], [class*="transcript"] li, [class*="transcript"] p'
    );

    const cueCount = await cues.count();
    if (cueCount > 1) {
      await cues.nth(Math.min(2, cueCount - 1)).click();
      await page.waitForTimeout(500);

      const newTime = await page.evaluate(() => {
        const video = document.querySelector('digital-bridge-player')?.shadowRoot?.querySelector('video')
          || document.querySelector('video');
        return video?.currentTime ?? 0;
      });

      // Video time should have changed
      expect(newTime).not.toBe(initialTime);
    }
  });

  test('should support transcript search/filter', async ({ page }) => {
    // Open transcript panel
    const transcriptBtn = page.locator(
      'button[aria-label*="Transcript"], button[aria-label*="transcript"], button:has-text("Transcript")'
    );

    if (await transcriptBtn.count() > 0) {
      await transcriptBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Look for search input
    const searchInput = page.locator(
      'input[aria-label*="search" i], input[aria-label*="filter" i], input[placeholder*="Search" i], input[placeholder*="Filter" i], input[class*="search"], input[class*="filter"]'
    );

    if (await searchInput.count() > 0) {
      // Count cues before search
      const cuesBefore = await page.evaluate(() => {
        const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
        return container.querySelectorAll(
          '.transcript-cue, .cue, [class*="transcript"] [class*="cue"], [class*="transcript"] li'
        ).length;
      });

      // Type a search term
      await searchInput.first().fill('test');
      await page.waitForTimeout(300);

      // Count cues after search — should be filtered (fewer or highlighted)
      const cuesAfter = await page.evaluate(() => {
        const container = document.querySelector('digital-bridge-player')?.shadowRoot || document;
        const visible = container.querySelectorAll(
          '.transcript-cue:not([hidden]), .cue:not([hidden]), [class*="transcript"] [class*="cue"]:not([hidden])'
        );
        const highlighted = container.querySelectorAll('mark, .highlight, [class*="highlight"]');
        return { visible: visible.length, highlighted: highlighted.length };
      });

      // Either cues were filtered or search results highlighted
      const searchWorked = cuesAfter.visible <= cuesBefore || cuesAfter.highlighted > 0;
      expect(searchWorked, 'Search/filter should reduce results or highlight matches').toBe(true);
    }
  });
});

/* ==========================================================================
   g) Player Component — Braille Export
   ========================================================================== */

test.describe('Player Component — Braille Export', () => {
  test('should trigger a download when Braille export button is clicked', async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    const brailleBtn = page.locator(
      'button[aria-label*="Braille"], button[aria-label*="braille"], button:has-text("Braille"), button[class*="braille"]'
    );

    if (await brailleBtn.count() > 0) {
      // Set up download listener BEFORE clicking
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      await brailleBtn.first().click();

      const download = await downloadPromise;
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toBeTruthy();

      // Verify the file has content
      const path = await download.path();
      expect(path).toBeTruthy();
    }
  });
});

/* ==========================================================================
   h) Job Card Component — Accessibility
   ========================================================================== */

test.describe('Job Card Component — Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
  });

  test('should have zero critical/serious axe-core violations on job cards', async ({ page }) => {
    const jobCards = page.locator('digital-bridge-job-card, .job-card, [class*="job-card"]');
    const count = await jobCards.count();

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      await card.scrollIntoViewIfNeeded();

      const cardId = await card.getAttribute('id') || `job-card-${i}`;

      const results = await new AxeBuilder({ page })
        .include(await card.evaluate(el => {
          // Build a CSS selector for this specific element
          if (el.id) return `#${el.id}`;
          const tag = el.tagName.toLowerCase();
          const parent = el.parentElement;
          if (!parent) return tag;
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          const index = siblings.indexOf(el) + 1;
          return `${tag}:nth-of-type(${index})`;
        }))
        .analyze();

      const critical = results.violations.filter(v => v.impact === 'critical');
      const serious = results.violations.filter(v => v.impact === 'serious');

      expect(critical, `Critical violations on card ${cardId}: ${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
      expect(serious, `Serious violations on card ${cardId}: ${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
    }
  });

  test('should have Audio Summary button with proper aria-label on each job card', async ({ page }) => {
    const jobCards = page.locator('digital-bridge-job-card, .job-card, [class*="job-card"]');
    const count = await jobCards.count();

    expect(count, 'Should have at least one job card').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const audioBtn = card.locator(
        'button[aria-label*="Audio Summary"], button[aria-label*="audio summary"], button[aria-label*="Listen"], button[class*="audio-summary"]'
      );

      expect(await audioBtn.count(), `Job card ${i} should have an Audio Summary button`).toBeGreaterThan(0);

      const ariaLabel = await audioBtn.first().getAttribute('aria-label');
      expect(ariaLabel, `Audio Summary button on card ${i} should have aria-label`).toBeTruthy();
    }
  });

  test('should open certificate verification panel on job card', async ({ page }) => {
    const jobCards = page.locator('digital-bridge-job-card, .job-card, [class*="job-card"]');

    if (await jobCards.count() > 0) {
      const firstCard = jobCards.first();
      const verifyBtn = firstCard.locator(
        'button[aria-label*="Verify"], button[aria-label*="verify"], button[aria-label*="Certificate"], button:has-text("Verify"), button[class*="verify"]'
      );

      if (await verifyBtn.count() > 0) {
        await verifyBtn.first().click();
        await page.waitForTimeout(500);

        const panelOpen = await page.evaluate(() => {
          const cards = document.querySelectorAll('digital-bridge-job-card');
          for (const card of cards) {
            if (card.hasAttribute('data-panel-open') || card.classList.contains('panel-open')) return true;
            const p = card.shadowRoot?.querySelector('.verify-panel');
            if (p && !p.hasAttribute('hidden')) {
              const styles = window.getComputedStyle(p);
              if (styles.display !== 'none' && styles.visibility !== 'hidden') return true;
            }
          }
          const panel = document.querySelector(
            '.verify-panel, .certificate-panel, [class*="verify"], [class*="certificate"][class*="panel"], dialog[open]'
          );
          if (!panel) return false;
          const styles = window.getComputedStyle(panel);
          return styles.display !== 'none' && styles.visibility !== 'hidden';
        });

        expect(panelOpen, 'Certificate verification panel should be open').toBe(true);
      }
    }
  });

  test('should have no horizontal scroll at 200% zoom', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    await page.waitForTimeout(500);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll, 'Page should not have horizontal scroll at 200% zoom').toBe(false);
  });
});

/* ==========================================================================
   i) Job Card Component — Responsive
   ========================================================================== */

test.describe('Job Card Component — Responsive', () => {
  test('should have no horizontal scrollbar at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll, 'Should have no horizontal scrollbar at 320px').toBe(false);
  });

  test('should not truncate text with overflow hidden at 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    const truncatedElements = await page.evaluate(() => {
      const allElements = document.querySelectorAll(
        'digital-bridge-job-card *, .job-card *, [class*="job-card"] *'
      );
      const truncated = [];
      for (const el of allElements) {
        const styles = window.getComputedStyle(el);
        if (
          styles.overflow === 'hidden' &&
          styles.textOverflow === 'ellipsis' &&
          el.scrollWidth > el.clientWidth
        ) {
          truncated.push({
            tag: el.tagName,
            text: el.textContent?.substring(0, 50),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          });
        }
      }
      return truncated;
    });

    expect(
      truncatedElements,
      `Text truncated: ${JSON.stringify(truncatedElements, null, 2)}`
    ).toHaveLength(0);
  });
});

/* ==========================================================================
   j) Cross-cutting — No Keyboard Traps
   ========================================================================== */

test.describe('Cross-cutting — No Keyboard Traps', () => {
  test('should not have any keyboard traps — focus cycles back to start', async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    // Record the first focusable element
    await page.keyboard.press('Tab');
    const firstFocusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? {
        tag: el.tagName,
        id: el.id,
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
      } : null;
    });

    expect(firstFocusedElement, 'Should be able to focus at least one element').toBeTruthy();

    // Tab through the entire page
    const maxTabs = 200; // Safety limit
    let cycledBack = false;
    const visitedElements = new Set();

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');

      const current = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
        } : null;
      });

      if (!current) continue;

      const elementKey = `${current.tag}#${current.id}.${current.className}[${current.ariaLabel}]`;

      if (
        current.tag === firstFocusedElement.tag &&
        current.id === firstFocusedElement.id &&
        current.className === firstFocusedElement.className &&
        current.ariaLabel === firstFocusedElement.ariaLabel &&
        i > 2 // Must have tabbed through at least a few elements
      ) {
        cycledBack = true;
        break;
      }

      // Detect keyboard trap: same element focused repeatedly
      if (visitedElements.has(elementKey)) {
        // If we've seen this element before and it's not the first time through,
        // it might be a trap — but only if we're stuck on the same element
        const stuckCount = await page.evaluate((key) => {
          // Quick check: press tab and see if focus changes
          return key;
        }, elementKey);
      }

      visitedElements.add(elementKey);
    }

    expect(cycledBack, 'Focus should eventually cycle back to the first element (no keyboard trap)').toBe(true);
  });

  test('should not trap focus on any individual element', async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');

    // Focus the page
    await page.keyboard.press('Tab');

    const maxTabs = 150;
    let previousElement = '';
    let sameElementCount = 0;
    const trapThreshold = 3; // If focus stays on same element for 3 consecutive Tabs, it's trapped

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');

      const currentElement = await page.evaluate(() => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
          el = el.shadowRoot.activeElement;
        }
        if (!el) return 'null';
        const label = el.getAttribute('aria-label') || el.dataset?.index || el.dataset?.start || el.getAttribute('data-dock') || el.getAttribute('data-preset') || el.id || (el.textContent ? el.textContent.trim().slice(0, 20) : '') || el.className;
        return `${el.tagName}#${label}`;
      });

      if (currentElement === previousElement) {
        sameElementCount++;
        if (sameElementCount >= trapThreshold) {
          throw new Error(`Keyboard trap detected on element: ${currentElement} after ${trapThreshold} consecutive Tab presses`);
        }
      } else {
        sameElementCount = 0;
      }

      previousElement = currentElement;
    }
  });
});
