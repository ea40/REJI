// @ts-check
const { test, expect } = require('@playwright/test');

/* ==========================================================================
   Audio description speech (bug B)

   speechSynthesis is replaced before any page script runs, so the shared
   arbiter and the player both talk to a recording fake.
   ========================================================================== */

const CUES = [
  { time: 0, text: 'A laptop screen shows a browser address bar. A hand types a web address into it.' },
  { time: 40, text: 'The server sends a document back to the browser.' }
];

const VOICE = [{ name: 'Fake English', lang: 'en-US', localService: true }];

async function mountPlayerWithCues(page) {
  return page.evaluate((cues) => {
    const el = document.createElement('digital-bridge-player');
    el.setAttribute('data-ad-cues', JSON.stringify(cues));
    document.body.appendChild(el);
    return new Promise((resolve) => window.setTimeout(() => resolve(true), 400));
  }, CUES);
}

test.describe('Audio description speech — shared arbiter', () => {
  test('UI announcements during an AD cue never cancel the cue', async ({ page }) => {
    await page.addInitScript((voices) => {
      window.__speechLog = [];
      const state = { speaking: false, pending: false };
      const fake = {
        get speaking() { return state.speaking; },
        get pending() { return state.pending; },
        getVoices() { return voices; },
        speak(utterance) {
          window.__speechLog.push({ type: 'speak', text: utterance.text });
          state.speaking = true;
          state.pending = true;
          window.setTimeout(() => { state.pending = false; if (utterance.onstart) utterance.onstart(); }, 0);
        },
        cancel() { window.__speechLog.push({ type: 'cancel' }); state.speaking = false; state.pending = false; },
        pause() { window.__speechLog.push({ type: 'pause' }); },
        resume() { window.__speechLog.push({ type: 'resume' }); },
        addEventListener() {},
        removeEventListener() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, get() { return fake; } });
      window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    }, VOICE);

    await page.goto('/demo.html');
    await page.waitForFunction(() => !!window.DBSpeech && !!window.DBTtsNav);
    await mountPlayerWithCues(page);

    const result = await page.evaluate(async () => {
      const el = document.querySelectorAll('digital-bridge-player')[1];
      el._adOn = true;
      el._enableADSpeech();
      el._speakADCue(0.1);
      await new Promise((r) => window.setTimeout(r, 200));

      const count = (type) => window.__speechLog.filter((e) => e.type === type).length;
      const before = { speak: count('speak'), cancel: count('cancel') };

      // While the cue is still speaking: focus change, letter navigation, page summary.
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'ሀ', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'ራ', bubbles: true }));
      await new Promise((r) => window.setTimeout(r, 300));

      return {
        before,
        after: { speak: count('speak'), cancel: count('cancel') },
        mediaActive: window.DBSpeech.isMediaActive(),
        live: (document.getElementById('dbt-tts-live') || {}).textContent || ''
      };
    });

    expect(result.mediaActive, 'the fake keeps the cue speaking').toBe(true);
    expect(result.after.cancel, 'no cancel() while audio description speaks').toBe(result.before.cancel);
    expect(result.after.speak, 'UI announcements must not queue over the cue').toBe(result.before.speak);
    expect(result.live.length, 'UI announcements go to the polite live region').toBeGreaterThan(0);
  });

  test('video pause pauses AD speech, play resumes it, seek re-syncs', async ({ page }) => {
    await page.addInitScript((voices) => {
      window.__speechLog = [];
      const state = { speaking: false, pending: false };
      const fake = {
        get speaking() { return state.speaking; },
        get pending() { return state.pending; },
        getVoices() { return voices; },
        speak(utterance) {
          window.__speechLog.push({ type: 'speak', text: utterance.text });
          state.speaking = true;
          state.pending = true;
          window.setTimeout(() => { state.pending = false; if (utterance.onstart) utterance.onstart(); }, 0);
        },
        cancel() { window.__speechLog.push({ type: 'cancel' }); state.speaking = false; state.pending = false; },
        pause() { window.__speechLog.push({ type: 'pause' }); },
        resume() { window.__speechLog.push({ type: 'resume' }); },
        addEventListener() {},
        removeEventListener() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, get() { return fake; } });
      window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    }, VOICE);

    await page.goto('/demo.html');
    await page.waitForFunction(() => !!window.DBSpeech && !!window.DBTtsNav);
    await mountPlayerWithCues(page);

    const result = await page.evaluate(async () => {
      const el = document.querySelectorAll('digital-bridge-player')[1];
      el._adOn = true;
      el._enableADSpeech();
      el._speakADCue(0.1);
      await new Promise((r) => window.setTimeout(r, 200));

      const vid = el._els.video;
      const beforeSeekIndex = el._lastSpokenADIndex;
      vid.dispatchEvent(new Event('pause'));
      vid.dispatchEvent(new Event('play'));
      await new Promise((r) => window.setTimeout(r, 100));
      vid.currentTime = 39;
      vid.dispatchEvent(new Event('seeked'));
      await new Promise((r) => window.setTimeout(r, 100));

      const types = window.__speechLog.map((e) => e.type);
      const afterSeekIndex = el._lastSpokenADIndex;

      // The cue at 40 seconds must be armed again after the seek.
      el._speakADCue(40.2);
      await new Promise((r) => window.setTimeout(r, 120));
      const lastSpoken = window.__speechLog.filter((e) => e.type === 'speak').pop();

      return {
        types,
        pauses: types.filter((t) => t === 'pause').length,
        resumes: types.filter((t) => t === 'resume').length,
        cancels: types.filter((t) => t === 'cancel').length,
        beforeSeekIndex,
        afterSeekIndex,
        lastSpokenText: lastSpoken ? lastSpoken.text : ''
      };
    });

    expect(result.pauses, 'pause must pause AD speech').toBeGreaterThan(0);
    expect(result.resumes, 'play must resume AD speech').toBeGreaterThan(0);
    expect(result.cancels, 'seek must cancel and re-sync AD speech').toBeGreaterThan(0);
    expect(result.afterSeekIndex, 'seek rewinds the cue pointer to before the seek target').toBe(-1);
    expect(result.afterSeekIndex).not.toBe(result.beforeSeekIndex);
    expect(result.lastSpokenText.toLowerCase()).toContain('server');
  });

  test('no installed voice is reported visibly and in the live region', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechLog = [];
      const fake = {
        speaking: false,
        pending: false,
        getVoices() { return []; },
        speak() { window.__speechLog.push({ type: 'speak' }); },
        cancel() { window.__speechLog.push({ type: 'cancel' }); },
        pause() {},
        resume() {},
        addEventListener() {},
        removeEventListener() {}
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, get() { return fake; } });
      window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    });

    await page.goto('/demo.html');
    await page.waitForFunction(() => !!window.DBSpeech && !!window.DBTtsNav);
    await mountPlayerWithCues(page);

    const result = await page.evaluate(async () => {
      const el = document.querySelectorAll('digital-bridge-player')[1];
      el._adOn = true;
      el._enableADSpeech();
      await new Promise((r) => window.setTimeout(r, 150));
      const notice = el.shadowRoot.querySelector('#ad-voice-notice');
      const alert = el.shadowRoot.querySelector('#sr-alert');
      return {
        hidden: notice ? notice.hidden : null,
        noticeText: notice ? notice.textContent : '',
        alertText: alert ? alert.textContent : ''
      };
    });

    expect(result.hidden, 'the no-voice notice must be visible').toBe(false);
    expect(result.noticeText.toLowerCase()).toContain('voice');
    expect(result.alertText.toLowerCase()).toContain('voice');
  });
});
