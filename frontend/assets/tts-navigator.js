/*!
 * Digital Bridge — Spoken Navigation (Text to Speech)
 * ---------------------------------------------------
 * Keyboard-driven speaking layer so a blind learner can hear and navigate a
 * page without a separate screen reader. Speech is ON by default and can be
 * switched off permanently by people who are not blind, or who already use a
 * screen reader.
 *
 * Shortcut routes (every one of them works without Alt+Shift, because Windows
 * uses Alt+Shift to change keyboard layout — including Amharic layouts):
 *
 *   1. The visible "Keys and speech" button, injected as the first tab stop.
 *   2. "?"  — opens the keyboard guide.
 *   3. Leader sequence: G then S (speech on/off), G then K (key guide).
 *   4. Alt+Shift+T / Alt+Shift+H — legacy alias only, may be swallowed by the OS.
 *
 * All letter shortcuts can be switched off (WCAG 2.1.4) from the panel, the
 * guide, or the first-visit notice; the setting is persisted per browser.
 *
 * Public API (window.DBTtsNav): enable(), disable(), toggle(), speak(text),
 * help(), summary(), setLetterKeys(bool), status().
 */
(function () {
  'use strict';

  if (window.DBTtsNav) return;

  var STORAGE_MODE = 'db-tts-enabled';
  var STORAGE_RATE = 'db-tts-rate';
  var STORAGE_LETTERS = 'db-tts-letter-keys';
  var STORAGE_NOTICE = 'db-tts-first-run';
  var DEFAULT_RATE = 1;
  var RATE_STEP = 0.25;
  var MIN_RATE = 0.5;
  var MAX_RATE = 2;
  var MAX_SPOKEN_CHARS = 280;
  var LEADER_WINDOW_MS = 1800;

  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  var UtteranceCtor = window.SpeechSynthesisUtterance || null;
  var speechSupported = !!(synth && UtteranceCtor);

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (err) { /* private mode */ }
  }

  var storedRate = parseFloat(readStorage(STORAGE_RATE));
  if (isNaN(storedRate) || storedRate < MIN_RATE || storedRate > MAX_RATE) storedRate = DEFAULT_RATE;

  var state = {
    supported: speechSupported,
    enabled: readStorage(STORAGE_MODE) !== 'off',       // blind-first default: speech ON
    letterKeys: readStorage(STORAGE_LETTERS) !== 'off', // WCAG 2.1.4 switch
    noticeDone: readStorage(STORAGE_NOTICE) === 'done',
    rate: storedRate,
    helpOpen: false,
    collapsed: false,
    spokenOnce: false,
    greeted: false,
    highlighted: null,
    suppressFocusAnnounce: false,
    leaderAt: 0,
    announceTimer: null,
    speakTimer: null,
    activeUtterance: null
  };

  var els = {};
  var COLLECTIONS = {};

  var KEY_GUIDE = [
    {
      title: 'Ways to open this guide (no Alt+Shift needed)',
      items: [
        ['Tab to "Keys and speech"', 'The visible button is the first Tab stop on every page'],
        ['?', 'Open or close this guide (Shift and the question-mark key)'],
        ['G then K', 'Leader sequence: press G, then K within two seconds'],
        ['Alt + Shift + H', 'Legacy alias only. Windows may use Alt+Shift to switch keyboard layout, so never rely on it']
      ]
    },
    {
      title: 'Speech and navigation',
      items: [
        ['G then S', 'Turn spoken navigation (text to speech) on or off'],
        ['Alt + Shift + T', 'Legacy alias for the same toggle, may be swallowed by Windows'],
        ['Tab / Shift + Tab', 'Move to the next or previous control and hear it spoken'],
        ['H / Shift + H', 'Jump to the next or previous heading'],
        ['D / Shift + D', 'Jump to the next or previous page region (main, navigation, section)'],
        ['L / Shift + L', 'Jump to the next or previous link'],
        ['B / Shift + B', 'Jump to the next or previous button'],
        ['F / Shift + F', 'Jump to the next or previous form field'],
        ['T / Shift + T', 'Jump to the next or previous block of text (paragraph, list item, table cell)'],
        ['E', 'Hear the item that has focus again'],
        ['R', 'Hear a summary of this page'],
        ['+ / -', 'Speak faster or slower'],
        ['Esc', 'Stop speaking immediately and close dialogs'],
        ['Enter or Space', 'Activate the focused link, button or control']
      ]
    },
    {
      title: 'Media player — after you Tab into the player',
      items: [
        ['Space or K', 'Play or pause the lesson video'],
        ['Left / Right arrow', 'Seek backward or forward 5 seconds'],
        ['J / L', 'Seek backward or forward 10 seconds'],
        ['M', 'Mute or unmute the lesson audio'],
        ['C', 'Show or hide the captions'],
        ['S', 'Show or hide the Ethiopian Sign Language window'],
        ['A', 'Turn audio description for blind learners on or off'],
        ['F', 'Enter or leave fullscreen'],
        ['?', 'Open the player keyboard help'],
        ['Esc', 'Close dialogs or leave fullscreen']
      ]
    },
    {
      title: 'Screen reader users',
      items: [
        ['I use a screen reader', 'The button in the first-visit notice turns off this layer\'s speech and letter keys, so NVDA, JAWS or TalkBack is the only voice'],
        ['Letter keys switch', 'Turn all single-letter shortcuts off while keeping the panel, Esc and the Tab route'],
        ['Why no auto-detect', 'Detecting a screen reader is unreliable, so the choice is yours and is remembered on this device']
      ]
    }
  ];

  /* ------------------------------------------------------------------ *
   * Text helpers
   * ------------------------------------------------------------------ */

  function normalizeText(value) {
    var text = String(value == null ? '' : value);
    text = text
      .replace(/\u2190/g, ' left arrow ')
      .replace(/\u2192/g, ' right arrow ')
      .replace(/\u2191/g, ' up arrow ')
      .replace(/\u2193/g, ' down arrow ')
      .replace(/[\u2039\u203A\u00AB\u00BB\u2022\u00B7\u2044]/g, ' ')
      .replace(/[\u2600-\u27BF\u2B50\uFE0E\uFE0F]/g, ' ')
      .replace(/[\u{1F000}-\u{1FAFF}]/gu, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > MAX_SPOKEN_CHARS) {
      text = text.slice(0, MAX_SPOKEN_CHARS - 1).replace(/[\s,;:.!?-]+$/, '') + '\u2026';
    }
    return text;
  }

  function textOf(el) {
    if (!el) return '';
    return normalizeText(el.textContent || '');
  }

  function writeLive(message) {
    if (!els.live || !message) return;
    els.live.textContent = '';
    window.setTimeout(function () { els.live.textContent = message; }, 30);
  }

  function pickVoice() {
    if (!synth || typeof synth.getVoices !== 'function') return null;
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (err) { voices = []; }
    if (!voices.length) return null;
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    var base = lang.split('-')[0];
    var matching = [];
    var i;
    for (i = 0; i < voices.length; i++) {
      if (String(voices[i].lang || '').toLowerCase().indexOf(base) === 0) matching.push(voices[i]);
    }
    for (i = 0; i < matching.length; i++) {
      if (matching[i].localService) return matching[i];
    }
    return matching[0] || null;
  }

  function cancelSpeech() {
    window.clearTimeout(state.speakTimer);
    state.speakTimer = null;
    state.activeUtterance = null;
    // Only the UI channel: audio description keeps speaking.
    if (window.DBSpeech) {
      window.DBSpeech.cancel('ui');
      return;
    }
    if (synth) {
      try { synth.cancel(); } catch (err) { /* ignore */ }
    }
  }

  /** Escape / Stop: silence everything, including audio description. */
  function stopAllSpeech() {
    window.clearTimeout(state.speakTimer);
    state.speakTimer = null;
    state.activeUtterance = null;
    if (window.DBSpeech) {
      window.DBSpeech.cancel('all');
      return;
    }
    if (synth) {
      try { synth.cancel(); } catch (err) { /* ignore */ }
    }
  }

  function doSpeak(text) {
    if (window.DBSpeech) {
      window.DBSpeech.speakUI(text, { liveFallback: writeLive });
      return;
    }
    if (!speechSupported) { writeLive(text); return; }

    var utterance = new UtteranceCtor(text);
    var voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = document.documentElement.getAttribute('lang') || 'en';
    }
    utterance.rate = state.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    var started = false;
    utterance.onstart = function () {
      started = true;
      state.spokenOnce = true;
    };
    utterance.onerror = function () {
      if (!started) writeLive(text);
    };
    // Keep a reference so the browser cannot collect the utterance.
    state.activeUtterance = utterance;

    try {
      synth.speak(utterance);
    } catch (err) {
      writeLive(text);
      return;
    }

    window.setTimeout(function () {
      if (!started && !synth.speaking && !synth.pending) writeLive(text);
    }, 450);
  }

  function speakNow(text) {
    var clean = normalizeText(text);
    if (!clean) return;
    if (window.DBSpeech && window.DBSpeech.isMediaActive()) {
      // Audio description owns the voice: announce politely instead of cutting it.
      writeLive(clean);
      return;
    }
    cancelSpeech();
    // Chrome drops an utterance queued in the same tick as cancel().
    state.speakTimer = window.setTimeout(function () { doSpeak(clean); }, 40);
  }

  function announce(message, options) {
    var opts = options || {};
    var clean = normalizeText(message);
    if (!clean) return;
    if (state.enabled || opts.force) {
      speakNow(clean);
    } else {
      writeLive(clean);
    }
  }

  /* ------------------------------------------------------------------ *
   * Element descriptions
   * ------------------------------------------------------------------ */

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hidden) return false;
    if (el.classList && (el.classList.contains('sr-only') || el.classList.contains('dbt-sr-only'))) return false;
    if (el.closest && el.closest('[aria-hidden="true"], script, style, template, noscript')) return false;
    if (!el.getClientRects().length) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function labelForInput(el) {
    var id = el.id;
    var name = '';
    if (id) {
      var escaped = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
      var explicit = document.querySelector('label[for="' + escaped + '"]');
      if (explicit) name = textOf(explicit);
    }
    if (!name && el.closest) {
      var wrapping = el.closest('label');
      if (wrapping) name = textOf(wrapping);
    }
    return name;
  }

  function accessibleName(el) {
    if (!el) return '';
    var name = normalizeText(el.getAttribute && el.getAttribute('aria-label'));
    if (name) return name;

    var labelledBy = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledBy) {
      var parts = [];
      var ids = labelledBy.split(/\s+/);
      for (var i = 0; i < ids.length; i++) {
        var ref = document.getElementById(ids[i]);
        if (ref) parts.push(textOf(ref));
      }
      name = normalizeText(parts.join(' '));
      if (name) return name;
    }

    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'img') return normalizeText(el.getAttribute('alt'));
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      var label = labelForInput(el) || normalizeText(el.getAttribute('placeholder'));
      if (label) return label;
      if (el.value && String(el.value).length) return normalizeText(el.value);
      return '';
    }
    return textOf(el);
  }

  function stateWords(el) {
    var words = [];
    var tag = (el.tagName || '').toLowerCase();
    var pressed = el.getAttribute('aria-pressed');
    var expanded = el.getAttribute('aria-expanded');
    var checked = el.getAttribute('aria-checked');
    var current = el.getAttribute('aria-current');

    if (pressed === 'true') words.push('pressed');
    else if (pressed === 'false') words.push('not pressed');
    if (expanded === 'true') words.push('expanded');
    else if (expanded === 'false') words.push('collapsed');
    if (checked === 'true') words.push('checked');
    else if (checked === 'false') words.push('not checked');
    if (el.disabled) words.push('unavailable');
    if (current === 'page' || current === 'true') words.push('current page');
    else if (current && current !== 'false') words.push('current ' + current);

    if (tag === 'input' && (el.type === 'checkbox' || el.type === 'radio')) {
      words.push(el.checked ? 'checked' : 'not checked');
    }
    if (tag === 'input' && el.type === 'range' && el.value) words.push('value ' + el.value);
    if (tag === 'select' && el.value) {
      var option = el.options[el.selectedIndex];
      if (option) words.push(normalizeText(option.textContent));
    }
    return words;
  }

  function roleOf(el) {
    var role = (el.getAttribute('role') || '').toLowerCase();
    var tag = (el.tagName || '').toLowerCase();
    switch (role) {
      case 'heading': return 'heading level ' + (el.getAttribute('aria-level') || '2');
      case 'button': return 'button';
      case 'link': return 'link';
      case 'navigation': return 'navigation region';
      case 'main': return 'main region';
      case 'banner': return 'banner region';
      case 'contentinfo': return 'footer region';
      case 'complementary': return 'complementary region';
      case 'region': return 'region';
      case 'search': return 'search region';
      case 'textbox': return 'edit text';
      case 'combobox': return 'combo box';
      case 'checkbox': return 'checkbox';
      case 'listitem': return 'list item';
      case 'dialog': return 'dialog';
      default: break;
    }
    switch (tag) {
      case 'a': return 'link';
      case 'button': return 'button';
      case 'h1': return 'heading level 1';
      case 'h2': return 'heading level 2';
      case 'h3': return 'heading level 3';
      case 'h4': return 'heading level 4';
      case 'h5': return 'heading level 5';
      case 'h6': return 'heading level 6';
      case 'main': return 'main region';
      case 'nav': return 'navigation region';
      case 'header': return 'banner region';
      case 'footer': return 'footer region';
      case 'aside': return 'complementary region';
      case 'section': return 'region';
      case 'article': return 'article';
      case 'form': return 'form';
      case 'img': return 'image';
      case 'select': return 'combo box';
      case 'textarea': return 'multiline edit text';
      case 'table': return 'table';
      case 'dialog': return 'dialog';
      case 'input':
        switch ((el.type || 'text').toLowerCase()) {
          case 'checkbox': return 'checkbox';
          case 'radio': return 'radio button';
          case 'submit': return 'button';
          case 'button': return 'button';
          case 'reset': return 'button';
          case 'range': return 'slider';
          case 'search': return 'search box';
          case 'email': return 'email field';
          case 'number': return 'number field';
          case 'password': return 'password field';
          case 'file': return 'file upload';
          default: return 'edit text';
        }
      default: return '';
    }
  }

  function describeElement(el) {
    if (!el || el === document.body) return 'Page body';
    var role = roleOf(el);
    var name = accessibleName(el);
    var states = stateWords(el);
    var parts = [];
    if (role) parts.push(role.charAt(0).toUpperCase() + role.slice(1));
    if (name && name.toLowerCase() !== role) parts.push(name);
    if (states.length) parts.push(states.join(', '));
    return parts.join(', ') || normalizeText(el.tagName ? el.tagName.toLowerCase() : 'item');
  }

  /* ------------------------------------------------------------------ *
   * Navigation commands
   * ------------------------------------------------------------------ */

  function speakSummary() {
    var headings = COLLECTIONS.heading().length;
    var links = COLLECTIONS.link().length;
    var buttons = COLLECTIONS.button().length;
    var regions = COLLECTIONS.region().length;
    var fields = COLLECTIONS.field().length;
    var firstHeading = document.querySelector('h1');
    var pageName = firstHeading ? textOf(firstHeading) : normalizeText(document.title);

    announce(
      'Page: ' + (pageName || 'untitled') + '. ' +
      headings + (headings === 1 ? ' heading' : ' headings') + ', ' +
      regions + (regions === 1 ? ' region' : ' regions') + ', ' +
      links + (links === 1 ? ' link' : ' links') + ', ' +
      buttons + (buttons === 1 ? ' button' : ' buttons') + ', ' +
      fields + (fields === 1 ? ' form field' : ' form fields') + '. ' +
      'Press H for headings, D for regions, Tab to walk through items. ' +
      'Press question mark, or G then K, for every key.'
    );
  }

  function describeFocused() {
    var el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      speakSummary();
      return;
    }
    if (el === els.helpDialog) {
      announce('Keyboard guide dialog');
      return;
    }
    announce(describeElement(el));
  }

  function nativelyFocusable(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'a') return el.hasAttribute('href');
    return tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'summary';
  }

  function reserveScrollSpace() {
    // WCAG 2.4.11: keep the focused element clear of the fixed panel.
    if (!els.panel || state.collapsed) return;
    var height = els.panel.getBoundingClientRect().height || 0;
    document.documentElement.style.scrollPaddingBottom = Math.ceil(height + 32) + 'px';
  }

  function focusAndDescribe(el, position) {
    if (!el) return;
    if (!nativelyFocusable(el) && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    if (state.highlighted && state.highlighted !== el) {
      state.highlighted.classList.remove('dbt-nav-target');
    }
    state.highlighted = el;
    el.classList.add('dbt-nav-target');

    state.suppressFocusAnnounce = true;
    try { el.focus({ preventScroll: true }); } catch (err) { try { el.focus(); } catch (err2) {} }
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (err3) {}
    window.setTimeout(function () { state.suppressFocusAnnounce = false; }, 0);

    announce(describeElement(el) + (position || ''));
  }

  function move(kind, direction) {
    var picker = COLLECTIONS[kind];
    if (!picker) return;
    var picks = picker();
    if (!picks.length) {
      announce('No ' + kind + ' found on this page.');
      return;
    }

    var active = document.activeElement;
    var index = -1;
    var i;
    for (i = 0; i < picks.length; i++) {
      if (picks[i] === active || (picks[i].contains && picks[i].contains(active))) { index = i; break; }
    }

    var next;
    if (index !== -1) {
      next = index + direction;
    } else if (active && active !== document.body) {
      next = direction > 0 ? 0 : picks.length - 1;
      for (i = 0; i < picks.length; i++) {
        var relation = active.compareDocumentPosition(picks[i]);
        if (direction > 0 && (relation & 4)) { next = i; break; } // DOCUMENT_POSITION_FOLLOWING
        if (direction < 0 && (relation & 2)) { next = i; }        // DOCUMENT_POSITION_PRECEDING
      }
    } else {
      next = direction > 0 ? 0 : picks.length - 1;
    }

    if (next >= picks.length) next = 0;
    if (next < 0) next = picks.length - 1;

    focusAndDescribe(picks[next], picks.length > 1 ? ', ' + (next + 1) + ' of ' + picks.length : '');
  }

  function formatRate() {
    return state.rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '\u00D7';
  }

  function changeRate(delta) {
    var next = Math.round((state.rate + delta) * 100) / 100;
    next = Math.min(MAX_RATE, Math.max(MIN_RATE, next));
    state.rate = next;
    writeStorage(STORAGE_RATE, next);
    renderRate();
    announce('Speech speed ' + next.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + ' times.');
  }

  /* ------------------------------------------------------------------ *
   * State, panel, notice and guide
   * ------------------------------------------------------------------ */

  function renderRate() {
    if (els.rate) els.rate.textContent = formatRate();
  }

  function renderState() {
    if (els.toggle) {
      els.toggle.textContent = 'Speech: ' + (state.enabled ? 'On' : 'Off');
      els.toggle.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
    }
    if (els.letters) {
      els.letters.textContent = 'Letter keys: ' + (state.letterKeys ? 'On' : 'Off');
      els.letters.setAttribute('aria-pressed', state.letterKeys ? 'true' : 'false');
    }
    if (els.status) {
      els.status.textContent = state.enabled ? 'On' : 'Off';
      els.status.className = 'dbt-status ' + (state.enabled ? 'is-on' : 'is-off');
    }
    if (els.launcher) {
      els.launcher.textContent = state.enabled ? '\uD83D\uDD0A Spoken navigation: on' : '\uD83D\uDD07 Spoken navigation: off';
    }
    if (els.firstStop) {
      els.firstStop.setAttribute('aria-expanded', state.helpOpen ? 'true' : 'false');
    }
    document.documentElement.setAttribute('data-dbt-tts', state.enabled ? 'on' : 'off');
    document.documentElement.setAttribute('data-dbt-letter-keys', state.letterKeys ? 'on' : 'off');
    renderRate();
  }

  function setEnabled(enabled) {
    state.enabled = !!enabled;
    writeStorage(STORAGE_MODE, state.enabled ? 'on' : 'off');
    renderState();
    document.dispatchEvent(new CustomEvent('dbt-tts:change', { detail: { enabled: state.enabled } }));

    if (state.enabled) {
      announce('Spoken navigation on. Everything that gets focus will be read aloud.', { force: true });
    } else {
      cancelSpeech();
      announce('Spoken navigation off. Text to speech is disabled.', { force: true });
    }
  }

  function setLetterKeys(enabled) {
    state.letterKeys = !!enabled;
    writeStorage(STORAGE_LETTERS, state.letterKeys ? 'on' : 'off');
    state.leaderAt = 0;
    renderState();
    document.dispatchEvent(new CustomEvent('dbt-tts:change', { detail: { enabled: state.enabled, letterKeys: state.letterKeys } }));
    announce(state.letterKeys
      ? 'Letter shortcuts on. H for headings, D for regions, question mark for the guide.'
      : 'Letter shortcuts off. Use Tab, the Keys and speech button, and Escape.');
  }

  function toggle() { setEnabled(!state.enabled); }

  function setCollapsed(collapsed) {
    state.collapsed = !!collapsed;
    if (!els.panel || !els.launcher) return;
    els.panel.hidden = state.collapsed;
    els.launcher.hidden = !state.collapsed;
    els.launcher.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
    if (state.collapsed) document.documentElement.style.scrollPaddingBottom = '';
    else reserveScrollSpace();
  }

  function openGuide() {
    if (!els.helpDialog || state.helpOpen) return;
    state.helpOpen = true;
    renderState();
    if (typeof els.helpDialog.showModal === 'function') {
      els.helpDialog.showModal();
    } else {
      els.helpDialog.setAttribute('open', '');
      els.helpDialog.classList.add('dbt-help-fallback');
    }
    announce('Keyboard guide. ' + KEY_GUIDE.length + ' groups. Press Tab to hear each key, Enter to hear it again, Escape to close.');
    window.setTimeout(function () {
      if (els.helpTitle) {
        state.suppressFocusAnnounce = true;
        try { els.helpTitle.focus(); } catch (err) {}
        window.setTimeout(function () { state.suppressFocusAnnounce = false; }, 0);
      }
    }, 120);
  }

  function closeGuide() {
    if (!els.helpDialog || !state.helpOpen) return;
    state.helpOpen = false;
    renderState();
    if (typeof els.helpDialog.close === 'function' && els.helpDialog.open) {
      els.helpDialog.close();
    } else {
      els.helpDialog.removeAttribute('open');
      els.helpDialog.classList.remove('dbt-help-fallback');
    }
    if (els.firstStop) {
      state.suppressFocusAnnounce = true;
      try { els.firstStop.focus(); } catch (err) {}
      window.setTimeout(function () { state.suppressFocusAnnounce = false; }, 0);
    }
  }

  function toggleGuide() {
    if (state.helpOpen) closeGuide();
    else openGuide();
  }

  function dismissNotice(useScreenReader) {
    if (useScreenReader) {
      state.enabled = false;
      state.letterKeys = false;
      writeStorage(STORAGE_MODE, 'off');
      writeStorage(STORAGE_LETTERS, 'off');
      cancelSpeech();
    }
    state.noticeDone = true;
    writeStorage(STORAGE_NOTICE, 'done');
    var notice = document.getElementById('dbt-tts-notice');
    if (notice) notice.remove();
    if (els.firstStop) els.firstStop.focus();
    renderState();
    if (!useScreenReader) {
      announce('Notice closed. Spoken navigation stays on.', { force: true });
    }
    document.dispatchEvent(new CustomEvent('dbt-tts:notice-dismissed', { detail: { useScreenReader: !!useScreenReader } }));
  }

  function buildNotice() {
    if (state.noticeDone) return;
    var notice = document.createElement('div');
    notice.className = 'dbt-notice';
    notice.id = 'dbt-tts-notice';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-labelledby', 'dbt-notice-title');
    notice.innerHTML =
      '<p class="dbt-notice-title" id="dbt-notice-title">Spoken navigation is turned on</p>' +
      '<p class="dbt-notice-body">This page can read itself aloud and move with single letters such as H for headings. ' +
        'If you are blind, keep it on. If you already use a screen reader such as NVDA, JAWS or TalkBack, choose the second button so nothing is read twice.</p>' +
      '<div class="dbt-notice-actions">' +
        '<button type="button" class="dbt-btn dbt-btn-primary" id="dbt-notice-keep">Keep spoken navigation on</button>' +
        '<button type="button" class="dbt-btn" id="dbt-notice-sr">I already use NVDA, JAWS or TalkBack</button>' +
      '</div>';
    document.body.insertBefore(notice, document.body.firstChild);
    els.notice = notice;
    notice.querySelector('#dbt-notice-keep').addEventListener('click', function () { dismissNotice(false); });
    notice.querySelector('#dbt-notice-sr').addEventListener('click', function () { dismissNotice(true); });
  }

  function buildFirstStop() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'dbt-firststop';
    button.id = 'dbt-tts-firststop';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-keyshortcuts', '?');
    button.textContent = '\u2328 Keys and speech';
    document.body.insertBefore(button, document.body.firstChild);
    els.firstStop = button;
    button.addEventListener('click', function () { toggleGuide(); });
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'dbt-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Spoken navigation controls');
    panel.innerHTML = '' +
      '<div class="dbt-panel-head">' +
        '<span class="dbt-title">Spoken navigation</span>' +
        '<span class="dbt-status is-on" id="dbt-tts-status">On</span>' +
        '<button type="button" class="dbt-btn dbt-btn-quiet" id="dbt-tts-collapse" aria-label="Hide spoken navigation controls">Hide</button>' +
      '</div>' +
      '<div class="dbt-row">' +
        '<button type="button" class="dbt-btn dbt-btn-primary" id="dbt-tts-toggle" aria-pressed="true" aria-keyshortcuts="Alt+Shift+T">Speech: On</button>' +
        '<button type="button" class="dbt-btn" id="dbt-tts-help" aria-keyshortcuts="?" aria-haspopup="dialog">Keys</button>' +
      '</div>' +
      '<div class="dbt-row">' +
        '<button type="button" class="dbt-btn" id="dbt-tts-summary">Read page</button>' +
        '<button type="button" class="dbt-btn" id="dbt-tts-stop">Stop speech</button>' +
      '</div>' +
      '<div class="dbt-row">' +
        '<button type="button" class="dbt-btn" id="dbt-tts-letters" aria-pressed="true">Letter keys: On</button>' +
      '</div>' +
      '<div class="dbt-row dbt-row-rate">' +
        '<span class="dbt-rate-label">Speed <span id="dbt-tts-rate">1\u00D7</span></span>' +
        '<button type="button" class="dbt-btn dbt-btn-small" id="dbt-tts-slower" aria-label="Speak slower">Slower</button>' +
        '<button type="button" class="dbt-btn dbt-btn-small" id="dbt-tts-faster" aria-label="Speak faster">Faster</button>' +
      '</div>' +
      '<p class="dbt-hint">Press <kbd>Tab</kbd> to the <strong>Keys and speech</strong> button, press <kbd>?</kbd>, or press <kbd>G</kbd> then <kbd>K</kbd>. ' +
      'Speech: <kbd>G</kbd> then <kbd>S</kbd>. Stop: <kbd>Esc</kbd>.</p>';

    var launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'dbt-launcher';
    launcher.id = 'dbt-tts-launcher';
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    launcher.textContent = 'Spoken navigation: on';

    var live = document.createElement('div');
    live.className = 'dbt-sr-only';
    live.id = 'dbt-tts-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    var dialog = document.createElement('dialog');
    dialog.className = 'dbt-guide';
    dialog.id = 'dbt-tts-guide';
    dialog.setAttribute('aria-labelledby', 'dbt-tts-guide-title');

    var groupsHtml = '';
    KEY_GUIDE.forEach(function (group) {
      groupsHtml += '<h3 class="dbt-guide-group">' + group.title + '</h3><ul class="dbt-key-list" role="list">';
      group.items.forEach(function (item) {
        groupsHtml += '<li class="dbt-key-row" tabindex="0"><span class="dbt-key">' + item[0] + '</span>' +
          '<span class="dbt-key-desc">' + item[1] + '</span></li>';
      });
      groupsHtml += '</ul>';
    });

    dialog.innerHTML = '' +
      '<div class="dbt-guide-head">' +
        '<h2 class="dbt-guide-title" id="dbt-tts-guide-title" tabindex="-1">Keyboard guide</h2>' +
        '<button type="button" class="dbt-btn dbt-btn-quiet" id="dbt-tts-guide-close" aria-label="Close keyboard guide">\u2715</button>' +
      '</div>' +
      '<p class="dbt-guide-intro">Every key that changes what you hear or where you are on this page. Tab through the list to hear each one; Enter repeats it. Escape closes this guide.</p>' +
      groupsHtml +
      '<button type="button" class="dbt-btn dbt-btn-primary dbt-guide-done" id="dbt-tts-guide-done">Got it, close the guide</button>';

    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    document.body.appendChild(live);
    document.body.appendChild(dialog);

    els.panel = panel;
    els.launcher = launcher;
    els.live = live;
    els.helpDialog = dialog;
    els.status = panel.querySelector('#dbt-tts-status');
    els.toggle = panel.querySelector('#dbt-tts-toggle');
    els.helpButton = panel.querySelector('#dbt-tts-help');
    els.summaryButton = panel.querySelector('#dbt-tts-summary');
    els.stopButton = panel.querySelector('#dbt-tts-stop');
    els.letters = panel.querySelector('#dbt-tts-letters');
    els.slower = panel.querySelector('#dbt-tts-slower');
    els.faster = panel.querySelector('#dbt-tts-faster');
    els.rate = panel.querySelector('#dbt-tts-rate');
    els.collapse = panel.querySelector('#dbt-tts-collapse');
    els.helpTitle = dialog.querySelector('#dbt-tts-guide-title');
    els.helpClose = dialog.querySelector('#dbt-tts-guide-close');
    els.helpDone = dialog.querySelector('#dbt-tts-guide-done');

    if (window.DBSpeech) window.DBSpeech.setLiveRegion(live);

    els.toggle.addEventListener('click', toggle);
    els.helpButton.addEventListener('click', openGuide);
    els.summaryButton.addEventListener('click', speakSummary);
    els.stopButton.addEventListener('click', function () { stopAllSpeech(); writeLive('Speech stopped'); });
    els.letters.addEventListener('click', function () { setLetterKeys(!state.letterKeys); });
    els.slower.addEventListener('click', function () { changeRate(-RATE_STEP); });
    els.faster.addEventListener('click', function () { changeRate(RATE_STEP); });
    els.collapse.addEventListener('click', function () {
      setCollapsed(true);
      launcher.focus();
    });
    launcher.addEventListener('click', function () {
      setCollapsed(false);
      if (els.toggle) els.toggle.focus();
    });
    els.helpClose.addEventListener('click', closeGuide);
    els.helpDone.addEventListener('click', closeGuide);

    dialog.addEventListener('close', function () {
      state.helpOpen = false;
      renderState();
    });
    dialog.addEventListener('cancel', function () {
      state.helpOpen = false;
      renderState();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        var row = event.target.closest ? event.target.closest('.dbt-key-row') : null;
        if (row) {
          event.preventDefault();
          announce(textOf(row));
          return;
        }
      }
      // Focus trap for browsers without native <dialog> support.
      if (event.key === 'Tab' && typeof dialog.showModal !== 'function') {
        var focusables = dialog.querySelectorAll('button, [tabindex="0"]');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function injectStyles() {
    var css = '' +
      '.dbt-firststop,.dbt-notice,.dbt-panel,.dbt-launcher,.dbt-guide,.dbt-key-row,.dbt-btn{box-sizing:border-box;}' +
      '.dbt-firststop{position:fixed;top:8px;right:8px;z-index:2147483003;font:inherit;font-size:13px;font-weight:700;' +
        'background:#FFE14D;color:#0B1120;border:2px solid #0B1120;border-radius:8px;padding:7px 12px;cursor:pointer;' +
        'min-height:36px;box-shadow:0 4px 14px rgba(0,0,0,.45);}' +
      '.dbt-firststop:hover{background:#FFF08A;}' +
      '.dbt-firststop:focus-visible{outline:3px solid #FFFFFF;outline-offset:2px;}' +
      '.dbt-notice{background:#111C2E;color:#FFFFFF;border-bottom:3px solid #FFE14D;padding:12px 16px;' +
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.5;' +
        'display:block;width:100%;max-width:100%;overflow-wrap:break-word;flex:0 0 auto;}' +
      '.dbt-notice-title{font-weight:700;font-size:15px;margin:0 0 4px;color:#FFFFFF;}' +
      '.dbt-notice-body{margin:0;color:#E2E8F0;max-width:72ch;}' +
      '.dbt-notice-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}' +
      '.dbt-notice .dbt-btn{flex:0 0 auto;}' +
      '.dbt-panel{position:fixed;left:16px;bottom:16px;z-index:2147483000;width:min(320px,calc(100vw - 32px));' +
        'background:#0B1120;color:#FFFFFF;border:2px solid #7DD3FC;border-radius:12px;padding:10px 12px 8px;' +
        'box-shadow:0 12px 32px rgba(0,0,0,.65);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
        'font-size:13px;line-height:1.4;text-align:left;}' +
      '.dbt-panel-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}' +
      '.dbt-title{font-weight:700;font-size:13px;color:#FFFFFF;flex:1;}' +
      '.dbt-status{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:999px;}' +
      '.dbt-status.is-on{background:rgba(0,255,136,.16);color:#6BFFB8;border:1px solid #00FF88;}' +
      '.dbt-status.is-off{background:rgba(148,163,184,.18);color:#E2E8F0;border:1px solid #94A3B8;}' +
      '.dbt-row{display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap;}' +
      '.dbt-btn{font:inherit;font-size:12.5px;font-weight:600;color:#FFFFFF;background:#16233B;border:1px solid #3B4E6E;' +
        'border-radius:7px;padding:7px 10px;cursor:pointer;flex:1;min-height:34px;}' +
      '.dbt-btn:hover{background:#1E2E4A;border-color:#7DD3FC;}' +
      '.dbt-btn:focus-visible{outline:3px solid #FFE14D;outline-offset:2px;}' +
      '.dbt-btn-primary{background:#00FF88;color:#04121A;border-color:#00FF88;}' +
      '.dbt-btn-primary:hover{background:#6BFFB8;border-color:#6BFFB8;color:#04121A;}' +
      '.dbt-btn-quiet{flex:0 0 auto;background:transparent;border-color:#3B4E6E;color:#CBD5E1;padding:4px 8px;min-height:28px;font-size:11.5px;}' +
      '.dbt-btn-small{flex:0 0 auto;padding:6px 9px;font-size:12px;min-height:32px;}' +
      '.dbt-row-rate{gap:8px;margin-bottom:0;}' +
      '.dbt-rate-label{font-size:12px;color:#CBD5E1;flex:1;}' +
      '.dbt-hint{margin:6px 0 0;font-size:11px;line-height:1.5;color:#CBD5E1;}' +
      '.dbt-hint kbd{background:#16233B;border:1px solid #3B4E6E;border-radius:3px;padding:0 3px;font-size:10.5px;color:#FFFFFF;font-family:inherit;}' +
      '.dbt-launcher{position:fixed;left:16px;bottom:16px;z-index:2147483000;font:inherit;font-size:13px;font-weight:700;' +
        'background:#0B1120;color:#FFFFFF;border:2px solid #7DD3FC;border-radius:999px;padding:9px 16px;cursor:pointer;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.6);}' +
      '.dbt-launcher:focus-visible{outline:3px solid #FFE14D;outline-offset:2px;}' +
      '.dbt-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}' +
      '.dbt-nav-target{outline:3px solid #FFE14D !important;outline-offset:2px !important;' +
        'box-shadow:0 0 0 6px rgba(255,225,77,.28) !important;border-radius:3px;}' +
      '.dbt-guide{border:2px solid #7DD3FC;border-radius:14px;background:#0B1120;color:#FFFFFF;padding:0;' +
        'width:min(680px,calc(100vw - 24px));max-height:82vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.75);' +
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}' +
      '.dbt-guide::backdrop{background:rgba(4,7,14,.82);}' +
      '.dbt-help-fallback{position:fixed;top:8vh;left:50%;transform:translateX(-50%);z-index:2147483001;display:block;}' +
      '.dbt-guide-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #1E293B;' +
        'position:sticky;top:0;background:#0B1120;}' +
      '.dbt-guide-title{font-size:17px;font-weight:700;color:#FFFFFF;margin:0;flex:1;}' +
      '.dbt-guide-title:focus-visible{outline:3px solid #FFE14D;outline-offset:2px;}' +
      '.dbt-guide-intro{margin:14px 18px 4px;font-size:13px;color:#CBD5E1;}' +
      '.dbt-guide-group{margin:16px 18px 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7DD3FC;}' +
      '.dbt-key-list{list-style:none;margin:0;padding:0 18px;display:flex;flex-direction:column;gap:4px;}' +
      '.dbt-key-row{display:flex;gap:14px;align-items:flex-start;padding:8px 10px;border:1px solid #1E293B;border-radius:8px;background:#0F172A;}' +
      '.dbt-key-row:focus{outline:3px solid #FFE14D;outline-offset:2px;background:#162038;}' +
      '.dbt-key{flex:0 0 190px;font-size:12.5px;font-weight:700;color:#6BFFB8;font-variant-numeric:tabular-nums;}' +
      '.dbt-key-desc{flex:1;font-size:12.5px;color:#E2E8F0;}' +
      '.dbt-guide-done{display:block;width:calc(100% - 36px);margin:18px;}' +
      '@media (max-width:520px){.dbt-key-row{flex-direction:column;gap:2px;}.dbt-key{flex:none;}' +
        '.dbt-panel{left:8px;right:8px;width:auto;bottom:8px;padding:8px 10px;}' +
        '.dbt-firststop{top:6px;right:6px;font-size:12px;padding:6px 9px;min-height:32px;}' +
        '.dbt-launcher{left:8px;bottom:8px;}}' +
      '@media (prefers-reduced-motion: reduce){.dbt-firststop,.dbt-panel,.dbt-guide{transition:none;}}';

    var style = document.createElement('style');
    style.id = 'dbt-tts-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Keyboard handling — read event.code, not event.key, so a non-Latin
   * (for example Amharic) keyboard layout cannot break the shortcuts.
   * ------------------------------------------------------------------ */

  function isTypingTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function insideRichComponent(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('digital-bridge-player, db-player, digital-bridge-job-card, db-job-card');
  }

  function onKeyDown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    var code = event.code || '';

    // Esc always stops speech immediately, on every page.
    if (code === 'Escape' || event.key === 'Escape') {
      if (state.helpOpen) {
        event.preventDefault();
        closeGuide();
        return;
      }
      stopAllSpeech();
      return;
    }

    // Legacy alias only — Windows may eat Alt+Shift to switch layout.
    if (event.altKey && event.shiftKey) {
      if (code === 'KeyT' || event.key === 'T' || event.key === 't') {
        event.preventDefault();
        toggle();
        return;
      }
      if (code === 'KeyH' || event.key === 'H' || event.key === 'h') {
        event.preventDefault();
        setCollapsed(false);
        toggleGuide();
        return;
      }
    }

    if (state.helpOpen) return;
    if (isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;   // browser / OS owned
    if (!event.shiftKey && insideRichComponent(event.target)) {
      state.leaderAt = 0;
      return;
    }

    // Everything below is a character shortcut: WCAG 2.1.4 switch applies.
    if (!state.letterKeys) {
      state.leaderAt = 0;
      return;
    }

    // Leader sequence: G then S / G then K.
    if (code === 'KeyG') {
      state.leaderAt = Date.now();
      event.preventDefault();
      return;
    }
    if (state.leaderAt && Date.now() - state.leaderAt < LEADER_WINDOW_MS) {
      if (code === 'KeyS') {
        state.leaderAt = 0;
        event.preventDefault();
        toggle();
        return;
      }
      if (code === 'KeyK') {
        state.leaderAt = 0;
        event.preventDefault();
        setCollapsed(false);
        openGuide();
        return;
      }
    }
    state.leaderAt = 0;

    var direction = event.shiftKey ? -1 : 1;

    switch (code) {
      case 'Slash':
        if (event.shiftKey) { event.preventDefault(); toggleGuide(); }
        return;
      case 'KeyH':
        event.preventDefault(); move('heading', direction); return;
      case 'KeyD':
        event.preventDefault(); move('region', direction); return;
      case 'KeyL':
        event.preventDefault(); move('link', direction); return;
      case 'KeyB':
        event.preventDefault(); move('button', direction); return;
      case 'KeyF':
        event.preventDefault(); move('field', direction); return;
      case 'KeyT':
        if (!event.shiftKey) { event.preventDefault(); move('text', direction); }
        return;
      case 'KeyE':
        event.preventDefault(); describeFocused(); return;
      case 'KeyR':
        event.preventDefault(); speakSummary(); return;
      case 'Equal': case 'NumpadAdd':
        event.preventDefault(); changeRate(RATE_STEP); return;
      case 'Minus': case 'NumpadSubtract':
        event.preventDefault(); changeRate(-RATE_STEP); return;
      default:
        return;
    }
  }

  function onFocusIn(event) {
    if (!state.enabled || state.suppressFocusAnnounce) return;
    var el = event.target;
    if (!el || el.nodeType !== 1 || el === document.body) return;
    var description = describeElement(el);
    if (!description) return;
    window.clearTimeout(state.announceTimer);
    state.announceTimer = window.setTimeout(function () { announce(description); }, 70);
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  function pick(selector) {
    var nodes = document.querySelectorAll(selector);
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) list.push(nodes[i]);
    }
    return list;
  }

  function collections() {
    COLLECTIONS.heading = function () { return pick('h1, h2, h3, h4, h5, h6, [role="heading"]'); };
    COLLECTIONS.region = function () {
      return pick('main, header, footer, nav, section, aside, article, form, dialog, ' +
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], ' +
        '[role="region"], [role="complementary"], [role="search"], [role="dialog"]');
    };
    COLLECTIONS.link = function () { return pick('a[href], [role="link"]'); };
    COLLECTIONS.button = function () {
      return pick('button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]');
    };
    COLLECTIONS.field = function () {
      return pick('input:not([type="hidden"]), select, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"]');
    };
    COLLECTIONS.text = function () {
      return pick('p, li, blockquote, pre, dd, dt, td, th, figcaption, h1, h2, h3, h4, h5, h6');
    };
  }

  function welcome() {
    var headings = COLLECTIONS.heading ? COLLECTIONS.heading().length : 0;
    var links = COLLECTIONS.link ? COLLECTIONS.link().length : 0;
    var regions = COLLECTIONS.region ? COLLECTIONS.region().length : 0;
    var firstHeading = document.querySelector('h1');
    var name = firstHeading ? textOf(firstHeading) : normalizeText(document.title);
    announce(
      (name || normalizeText(document.title) || 'Page') + '. Spoken navigation is on. ' +
      headings + (headings === 1 ? ' heading' : ' headings') + ', ' +
      regions + (regions === 1 ? ' region' : ' regions') + ', ' +
      links + (links === 1 ? ' link' : ' links') + '. ' +
      'Press H for the next heading, Tab to walk through items. ' +
      'Press question mark, or G then K, for the keyboard guide. ' +
      'Press G then S to turn speech off.',
      { force: true }
    );
  }

  function greet() {
    if (state.greeted || !state.enabled) return;
    state.greeted = true;
    welcome();
  }

  function init() {
    injectStyles();
    buildPanel();
    buildNotice();
    buildFirstStop();
    collections();
    renderState();
    reserveScrollSpace();
    window.addEventListener('resize', reserveScrollSpace);

    if (!speechSupported) {
      writeLive('This browser has no speech synthesiser. Text is announced through the page live region only.');
      if (els.panel) {
        var warn = document.createElement('p');
        warn.className = 'dbt-hint';
        warn.id = 'dbt-tts-novoice';
        warn.textContent = 'No speech voice is available in this browser, so announcements appear as text only.';
        warn.setAttribute('role', 'status');
        els.panel.appendChild(warn);
      }
    } else if (synth && typeof synth.getVoices === 'function' && !pickVoice()) {
      var voiceWarn = document.createElement('p');
      voiceWarn.className = 'dbt-hint';
      voiceWarn.id = 'dbt-tts-novoice';
      voiceWarn.setAttribute('role', 'status');
      voiceWarn.textContent = 'No installed voice was detected yet. If nothing is spoken, install a system voice for this language.';
      if (els.panel) els.panel.appendChild(voiceWarn);
    }
    if (window.DBSpeech) {
      window.DBSpeech.on('novoice', function () {
        writeLive('No speech voice is available. Announcements will appear as text only.');
        if (els.panel && !document.getElementById('dbt-tts-novoice')) {
          var note = document.createElement('p');
          note.className = 'dbt-hint';
          note.id = 'dbt-tts-novoice';
          note.setAttribute('role', 'status');
          note.textContent = 'No speech voice is available\u2014audio description and navigation are text only.';
          els.panel.appendChild(note);
        }
      });
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    var retryGreeting = function () {
      if (!state.spokenOnce) {
        state.greeted = false;
        greet();
      }
    };
    if (state.enabled) {
      if (document.readyState === 'complete') {
        window.setTimeout(greet, 350);
      } else {
        window.addEventListener('load', function () { window.setTimeout(greet, 350); });
      }
      document.addEventListener('pointerdown', retryGreeting, { once: true, capture: true });
      document.addEventListener('keydown', retryGreeting, { once: true, capture: true });
    }

    window.DBTtsNav = {
      enable: function () { setEnabled(true); },
      disable: function () { setEnabled(false); },
      toggle: toggle,
      setLetterKeys: setLetterKeys,
      speak: function (text) { announce(text, { force: true }); },
      announce: announce,
      stop: cancelSpeech,
      help: openGuide,
      summary: speakSummary,
      noticeDismissed: function () { return state.noticeDone; },
      status: function () {
        return {
          enabled: state.enabled,
          letterKeys: state.letterKeys,
          supported: state.supported,
          rate: state.rate,
          noticeDone: state.noticeDone
        };
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
