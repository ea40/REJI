/**
 * <digital-bridge-player> — Accessible Learning Media Web Component
 * Digital Bridge Accessibility Hackathon 2026 · Track 2
 *
 * A fully self-contained, zero-dependency video player built with Shadow DOM.
 * Features: adaptive presets (Deaf/HoH, Blind/SR, Motor, Low-BW),
 * dual EN/AM WebVTT captions, EthSL sign-language overlay, audio description
 * (Web Audio API duck + Speech API fallback), interactive transcript,
 * live-session chat replay, Grade-1 Braille export (.brf), and offline ZIP pack.
 *
 * @license MIT
 */

/* ================================================================
   1. CONSTANTS & HELPERS
   ================================================================ */

/** Grade-1 ASCII Braille lookup (letters a-z mapped to BRF byte values). */
const BRAILLE_ASCII = {
  a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', h: 'H',
  i: 'I', j: 'J', k: 'K', l: 'L', m: 'M', n: 'N', o: 'O', p: 'P',
  q: 'Q', r: 'R', s: 'S', t: 'T', u: 'U', v: 'V', w: 'W', x: 'X',
  y: 'Y', z: 'Z',
  '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E',
  '6': 'F', '7': 'G', '8': 'H', '9': 'I', '0': 'J',
  ' ': ' ', '.': '4', ',': '1', ';': '2', ':': '3',
  '!': '6', '?': '8', '-': '-', '\'': "'", '"': '7'
};

/**
 * Convert plain text to Grade-1 ASCII Braille (.brf format).
 * @param {string} text - Source text.
 * @param {number} lineWidth - Characters per line (default 40 for standard BRF).
 * @returns {string} BRF string.
 */
function textToBrf(text, lineWidth = 40) {
  const lines = text.split('\n');
  const brfLines = [];
  for (const line of lines) {
    let brfLine = '';
    for (const ch of line) {
      const lower = ch.toLowerCase();
      brfLine += BRAILLE_ASCII[lower] || ch;
    }
    // Wrap to lineWidth
    while (brfLine.length > lineWidth) {
      brfLines.push(brfLine.slice(0, lineWidth));
      brfLine = brfLine.slice(lineWidth);
    }
    brfLines.push(brfLine);
  }
  return brfLines.join('\r\n');
}

/**
 * Minimal ZIP builder — STORE method only (no compression).
 * Produces a valid ZIP archive entirely client-side.
 */
class MiniZip {
  constructor() {
    /** @type {{name:Uint8Array, data:Uint8Array, crc:number}[]} */
    this.files = [];
  }

  /** CRC-32 table (generated once). */
  static get crcTable() {
    if (!MiniZip._crcTable) {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      MiniZip._crcTable = t;
    }
    return MiniZip._crcTable;
  }

  /** Compute CRC-32 of a Uint8Array. */
  static crc32(buf) {
    const table = MiniZip.crcTable;
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /** Add a file to the archive. */
  addFile(name, content) {
    const enc = new TextEncoder();
    const nameBytes = enc.encode(name);
    const dataBytes = typeof content === 'string' ? enc.encode(content) : content;
    this.files.push({ name: nameBytes, data: dataBytes, crc: MiniZip.crc32(dataBytes) });
  }

  /** Build the ZIP and return a Blob. */
  toBlob() {
    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const f of this.files) {
      // Local file header
      const local = new Uint8Array(30 + f.name.length + f.data.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034B50, true);   // signature
      dv.setUint16(4, 20, true);            // version needed
      dv.setUint16(6, 0, true);             // flags
      dv.setUint16(8, 0, true);             // compression: STORE
      dv.setUint16(10, 0, true);            // mod time
      dv.setUint16(12, 0, true);            // mod date
      dv.setUint32(14, f.crc, true);        // crc-32
      dv.setUint32(18, f.data.length, true);// compressed size
      dv.setUint32(22, f.data.length, true);// uncompressed size
      dv.setUint16(26, f.name.length, true);// file name length
      dv.setUint16(28, 0, true);            // extra field length
      local.set(f.name, 30);
      local.set(f.data, 30 + f.name.length);
      parts.push(local);

      // Central directory entry
      const cd = new Uint8Array(46 + f.name.length);
      const cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014B50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, f.crc, true);
      cdv.setUint32(20, f.data.length, true);
      cdv.setUint32(24, f.data.length, true);
      cdv.setUint16(28, f.name.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0x20, true);
      cdv.setUint32(42, offset, true);
      cd.set(f.name, 46);
      centralDir.push(cd);

      offset += local.length;
    }

    // Central directory
    let cdSize = 0;
    for (const cd of centralDir) { parts.push(cd); cdSize += cd.length; }

    // End-of-central-directory record
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, this.files.length, true);
    ev.setUint16(10, this.files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }
}

/**
 * Simple WebVTT parser.
 * Returns an array of {id, startTime, endTime, text} objects.
 */
function parseVTT(raw) {
  const cues = [];
  // Normalise line endings and strip BOM
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find the timing line
    let timingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { timingIdx = i; break; }
    }
    if (timingIdx === -1) continue;

    const id = timingIdx > 0 ? lines.slice(0, timingIdx).join(' ') : '';
    const timing = lines[timingIdx];
    const match = timing.match(
      /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (!match) continue;

    const startTime =
      (match[1] ? parseInt(match[1]) * 3600 : 0) +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000;
    const endTime =
      (match[5] ? parseInt(match[5]) * 3600 : 0) +
      parseInt(match[6]) * 60 +
      parseInt(match[7]) +
      parseInt(match[8]) / 1000;

    const cueText = lines.slice(timingIdx + 1).join('\n');
    cues.push({ id, startTime, endTime, text: cueText });
  }
  return cues;
}

/**
 * Format seconds to mm:ss or h:mm:ss display string.
 */
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ================================================================
   2. STYLES (template literal)
   ================================================================ */

const COMPONENT_STYLES = /* css */ `
  :host {
    display: block;
    contain: content;
    font-family: 'Segoe UI', 'Noto Sans Ethiopic', system-ui, sans-serif;
    color: #E6F1FF;
    background: #0A192F;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    line-height: 1.5;
    font-size: 16px;
    --accent: #00FF88;
    --bg: #0A192F;
    --bg-light: #112240;
    --text: #E6F1FF;
    --text-muted: #8892B0;
    --btn-min: 44px;
    --focus-outline: 3px solid var(--accent);
    --gap: 8px;
  }

  :host([hidden]) { display: none; }

  *, *::before, *::after { box-sizing: border-box; }

  /* ---- Focus styles ---- */
  *:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 2px;
  }

  /* ---- Buttons ---- */
  button, [role="button"] {
    font-family: inherit;
    font-size: 14px;
    color: var(--text);
    background: var(--bg-light);
    border: 1px solid #233554;
    border-radius: 6px;
    cursor: pointer;
    min-width: var(--btn-min);
    min-height: var(--btn-min);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    transition: background 0.15s, transform 0.1s;
    gap: 4px;
    white-space: nowrap;
  }
  button:hover { background: #1D3461; }
  button:active { transform: scale(0.97); }
  button[aria-pressed="true"] {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  /* ---- Layout ---- */
  .player-root {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-light);
    align-items: center;
    border-bottom: 1px solid #233554;
  }
  .toolbar-label {
    font-size: 13px;
    color: var(--text-muted);
    margin-right: 6px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .toolbar button {
    font-size: 12px;
    padding: 4px 12px;
    min-height: 36px;
    border-radius: 18px;
  }

  .lesson-title {
    padding: 6px 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg);
    border-bottom: 1px solid #233554;
  }

  .main-layout {
    display: flex;
    flex-direction: row;
    width: 100%;
  }
  @media (max-width: 720px) {
    .main-layout { flex-direction: column; }
    .side-panel { max-height: 300px; }
  }

  /* ---- Video area ---- */
  .video-area {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    background: #000;
    display: flex;
    flex-direction: column;
  }
  .video-wrapper {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 */
    background: #000;
    overflow: hidden;
  }
  .video-wrapper video {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: block;
    object-fit: contain;
  }

  /* ---- Captions overlay ---- */
  .caption-overlay {
    position: absolute;
    bottom: 60px; left: 50%;
    transform: translateX(-50%);
    width: 90%;
    text-align: center;
    pointer-events: none;
    z-index: 5;
  }
  .caption-line {
    display: inline-block;
    padding: 4px 10px;
    margin: 2px 0;
    border-radius: 4px;
    font-weight: 500;
    line-height: 1.4;
    max-width: 100%;
    word-wrap: break-word;
  }
  /* Caption themes */
  .caption-line.theme-wob { background: rgba(0,0,0,0.85); color: #fff; }
  .caption-line.theme-yob { background: rgba(0,0,0,0.85); color: #FFD700; }
  .caption-line.theme-boc { background: rgba(255,253,240,0.92); color: #1a1a1a; }

  .sound-badge {
    display: inline-block;
    background: var(--accent);
    color: var(--bg);
    font-size: 0.75em;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
    margin: 0 3px;
    vertical-align: middle;
  }

  /* ---- EthSL overlay ---- */
  .ethsl-overlay {
    position: absolute;
    z-index: 10;
    background: #000;
    border: 2px solid var(--accent);
    border-radius: 6px;
    overflow: hidden;
    display: none;
    flex-direction: column;
    min-width: 160px;
    min-height: 120px;
    cursor: grab;
  }
  .ethsl-overlay.open { display: flex; }
  .ethsl-overlay video {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
  }
  .ethsl-standby {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    background: #0B1120;
    color: #F8FAFC;
    text-align: center;
    height: 100%;
    user-select: none;
  }
  .ethsl-icon { font-size: 24px; margin-bottom: 4px; }
  .ethsl-badge {
    font-size: 11px;
    font-weight: 700;
    color: #00FF88;
    background: rgba(0, 255, 136, 0.15);
    border: 1px solid rgba(0, 255, 136, 0.4);
    border-radius: 4px;
    padding: 2px 6px;
    margin-bottom: 4px;
  }
  .ethsl-text {
    font-size: 10px;
    line-height: 1.3;
    color: #94A3B8;
    margin-bottom: 4px;
  }
  .ethsl-sub {
    font-size: 8px;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .live-subtitle-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #00FF88;
    background: rgba(6, 10, 19, 0.85);
    border: 1px solid rgba(0, 255, 136, 0.5);
    border-radius: 4px;
    padding: 2px 8px;
    margin-bottom: 6px;
  }
  .live-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00FF88;
    display: inline-block;
    box-shadow: 0 0 8px #00FF88;
    animation: livePulse 1.5s infinite;
  }
  @keyframes livePulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.6; }
  }
  .live-cursor {
    color: #00FF88;
    display: inline-block;
    font-weight: 900;
    animation: liveCursorBlink 0.8s infinite;
  }
  @keyframes liveCursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .ethsl-overlay .resize-handle {
    position: absolute;
    bottom: 0; right: 0;
    width: 18px; height: 18px;
    cursor: nwse-resize;
    background: var(--accent);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
  .ethsl-dock-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px;
    background: var(--bg-light);
    border-top: 1px solid #233554;
  }
  .ethsl-dock-bar button {
    font-size: 10px;
    min-width: 32px;
    min-height: 28px;
    padding: 2px 6px;
  }

  /* ---- Controls bar ---- */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-light);
    border-top: 1px solid #233554;
    position: relative;
    z-index: 6;
  }
  .controls button { min-width: var(--btn-min); min-height: var(--btn-min); }

  .progress-container {
    flex: 1 1 120px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .progress-bar {
    flex: 1;
    height: 6px;
    background: #233554;
    border-radius: 3px;
    position: relative;
    cursor: pointer;
  }
  .progress-bar:focus-visible { outline: var(--focus-outline); outline-offset: 4px; }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    width: 0%;
    pointer-events: none;
  }
  .time-display {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 80px;
    text-align: center;
  }

  .volume-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #233554;
    border-radius: 2px;
    outline: none;
    width: 70px;
    cursor: pointer;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    background: var(--accent);
    border-radius: 50%;
    cursor: pointer;
  }
  input[type="range"]::-moz-range-thumb {
    width: 14px; height: 14px;
    background: var(--accent);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }
  input[type="range"]:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 4px;
  }

  /* ---- Caption style drawer ---- */
  .caption-drawer {
    display: none;
    padding: 10px 12px;
    background: var(--bg-light);
    border-top: 1px solid #233554;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .caption-drawer.open { display: flex; }
  .caption-drawer label {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .caption-drawer select {
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid #233554;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .caption-drawer select:focus-visible {
    outline: var(--focus-outline);
  }

  /* ---- Side panel (Transcript + Chat) ---- */
  .side-panel {
    width: 340px;
    min-width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #233554;
    background: var(--bg);
    max-height: 600px;
    overflow: hidden;
  }
  @media (max-width: 720px) {
    .side-panel {
      width: 100%;
      border-left: none;
      border-top: 1px solid #233554;
    }
  }
  .side-tabs {
    display: flex;
    background: var(--bg-light);
    border-bottom: 1px solid #233554;
  }
  .side-tabs button {
    flex: 1;
    border: none;
    border-radius: 0;
    border-bottom: 2px solid transparent;
    min-height: 38px;
    font-size: 13px;
    background: transparent;
  }
  .side-tabs button[aria-selected="true"] {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .tab-pane {
    display: none;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
  .tab-pane.active {
    display: flex;
  }

  /* Transcript */
  .transcript-search {
    padding: 6px 8px;
    border-bottom: 1px solid #233554;
  }
  .transcript-search input {
    width: 100%;
    font-family: inherit;
    font-size: 13px;
    padding: 6px 10px;
    background: var(--bg-light);
    color: var(--text);
    border: 1px solid #233554;
    border-radius: 4px;
  }
  .transcript-search input::placeholder { color: var(--text-muted); }
  .transcript-search input:focus-visible { outline: var(--focus-outline); }

  .transcript-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }
  .transcript-cue {
    display: flex;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
    min-height: var(--btn-min);
    font-size: 13px;
    color: var(--text);
    align-items: flex-start;
    font-family: inherit;
    line-height: 1.4;
    justify-content: flex-start;
  }
  .transcript-cue:hover { background: var(--bg-light); }
  .transcript-cue.active { background: #1a3a5c; border-left: 3px solid var(--accent); }
  .transcript-time, .transcript-cue-time {
    color: var(--accent);
    font-size: 11px;
    min-width: 48px;
    flex-shrink: 0;
    padding-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  /* Chat replay */
  .chat-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }
  .chat-msg {
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
    color: var(--text);
    font-family: inherit;
    min-height: var(--btn-min);
    justify-content: center;
  }
  .chat-msg:hover { background: var(--bg-light); }
  .chat-msg.active { background: #1a3a5c; }
  .chat-msg-meta {
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
  }
  .chat-msg-user { color: var(--accent); font-weight: 600; }

  /* ---- Bottom toolbar (export/download) ---- */
  .bottom-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-light);
    border-top: 1px solid #233554;
    align-items: center;
  }
  .bottom-bar button { font-size: 12px; }
  .download-progress {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 8px;
  }

  /* ---- Motor preset overrides ---- */
  :host(.motor) button,
  :host(.motor) [role="button"] {
    --btn-min: 48px;
    min-width: 48px;
    min-height: 48px;
    margin: 2px;
  }
  :host(.motor) .controls { gap: 12px; }

  /* ---- Low-bandwidth mode ---- */
  .lowbw-notice {
    display: none;
    padding: 20px;
    text-align: center;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .lowbw-notice.active { display: flex; }
  .lowbw-notice p { max-width: 400px; }

  /* ---- Screen reader only utility ---- */
  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
    border: 0;
  }

  /* ---- Motor extra nav buttons ---- */
  .motor-extra {
    display: none;
    gap: 4px;
  }
  :host(.motor) .motor-extra { display: flex; }

  /* ---- Reduced motion ---- */
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }

  /* ---- Keyboard nav hint ---- */
  .keyboard-hint {
    position: absolute;
    top: 8px; left: 8px;
    background: rgba(0,0,0,0.8);
    color: var(--accent);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    z-index: 20;
    display: none;
    pointer-events: none;
  }
  .keyboard-hint.show { display: block; }
`;

/* ================================================================
   3. HTML TEMPLATE
   ================================================================ */

const COMPONENT_HTML = /* html */ `
<div class="player-root" role="region" aria-label="Digital Bridge accessible video player">

  <!-- Live region for state announcements (screen readers) -->
  <div class="sr-only" aria-live="polite" id="sr-announce"></div>
  <div class="sr-only" aria-live="assertive" id="sr-alert"></div>

  <!-- Adaptive presets toolbar -->
  <div class="toolbar" role="toolbar" aria-label="Customize Experience">
    <span class="toolbar-label" id="preset-label">Customize Experience</span>
    <button type="button" data-preset="standard" aria-pressed="true" aria-describedby="preset-label">Standard</button>
    <button type="button" data-preset="deaf" aria-pressed="false" aria-describedby="preset-label">Deaf / HoH</button>
    <button type="button" data-preset="blind" aria-pressed="false" aria-describedby="preset-label">Blind / SR</button>
    <button type="button" data-preset="motor" aria-pressed="false" aria-describedby="preset-label">One-Hand / Motor</button>
    <button type="button" data-preset="lowbw" aria-pressed="false" aria-describedby="preset-label">3G / Low-BW</button>
  </div>

  <!-- Lesson title -->
  <div class="lesson-title" role="heading" aria-level="2" id="lesson-heading"></div>

  <!-- Main layout -->
  <div class="main-layout">

    <!-- Video area -->
    <div class="video-area">
      <div class="video-wrapper" id="video-wrapper">
        <video id="main-video" playsinline preload="metadata" tabindex="-1">
          <track kind="subtitles" srclang="en" label="English" src="assets/captions-en.vtt" default>
          <track kind="subtitles" srclang="am" label="Amharic (አማርኛ)" src="assets/captions-am.vtt">
        </video>

        <!-- Caption overlay -->
        <div class="caption-overlay caption-display captions" id="caption-overlay" aria-hidden="true"></div>

        <!-- EthSL overlay -->
        <div class="ethsl-overlay" id="ethsl-overlay" tabindex="0"
             role="region" aria-label="Ethiopian Sign Language video overlay">
          <video id="ethsl-video" playsinline muted tabindex="-1"></video>
          <div id="ethsl-standby" class="ethsl-standby" role="status" aria-label="EthSL Interpreter status">
            <span class="ethsl-icon" aria-hidden="true">🤟</span>
            <div class="ethsl-badge">EthSL · የኢትዮጵያ ምልክት ቋንቋ</div>
            <p class="ethsl-text">Human interpreter recording scheduled with ENAD (Ethiopian National Association of the Deaf).</p>
            <span class="ethsl-sub">WCAG 1.2.6 AAA · Verified Human Signing</span>
          </div>
          <div class="resize-handle" id="ethsl-resize" aria-hidden="true"></div>
          <div class="ethsl-dock-bar" role="toolbar" aria-label="Sign language window position">
            <button type="button" data-dock="tl" aria-label="Dock Top-Left">↖</button>
            <button type="button" data-dock="tr" aria-label="Dock Top-Right">↗</button>
            <button type="button" data-dock="bl" aria-label="Dock Bottom-Left">↙</button>
            <button type="button" data-dock="br" aria-label="Dock Bottom-Right">↘</button>
            <button type="button" data-dock="sbs" aria-label="Side by Side">⇔</button>
          </div>
        </div>

        <!-- Keyboard hint (shown briefly when player gains focus) -->
        <div class="keyboard-hint" id="kb-hint">Keys: Space/K Play · J −10s · L +10s · M Mute · C Captions · S Sign · A Audio Desc</div>
      </div>

      <!-- Low-bandwidth fallback notice -->
      <div class="lowbw-notice" id="lowbw-notice" role="alert">
        <p><strong>Low-bandwidth mode active.</strong> Video is paused to conserve data. You can listen to the audio or read the transcript.</p>
        <button type="button" id="lowbw-audio-btn" aria-label="Play audio only">▶ Audio Only</button>
        <button type="button" id="lowbw-resume-btn" aria-label="Resume video anyway">Resume Video</button>
      </div>

      <!-- Player controls -->
      <div class="controls" role="toolbar" aria-label="Video controls">
        <button type="button" id="play-btn" aria-label="Play" aria-pressed="false">▶</button>

        <div class="motor-extra">
          <button type="button" id="back15-btn" aria-label="Back 15 seconds">−15s</button>
        </div>
        <button type="button" id="back10-btn" aria-label="Back 10 seconds">−10s</button>
        <button type="button" id="fwd10-btn" aria-label="Forward 10 seconds">+10s</button>
        <div class="motor-extra">
          <button type="button" id="fwd15-btn" aria-label="Forward 15 seconds">+15s</button>
        </div>

        <div class="progress-container">
          <div class="progress-bar" id="progress-bar" role="slider"
               aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
               tabindex="0">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span class="time-display" id="time-display">0:00 / 0:00</span>
        </div>

        <div class="volume-group">
          <button type="button" id="mute-btn" aria-label="Mute" aria-pressed="false">🔊</button>
          <input type="range" id="volume-slider" min="0" max="1" step="0.05" value="1"
                 aria-label="Volume">
        </div>

        <button type="button" id="captions-btn" aria-label="Toggle captions" aria-pressed="false">CC</button>
        <button type="button" id="caption-style-btn" aria-label="Caption settings" aria-expanded="false">⚙</button>
        <button type="button" id="ethsl-btn" aria-label="Toggle sign language" aria-pressed="false">🤟</button>
        <button type="button" id="ad-btn" aria-label="Toggle audio description" aria-pressed="false">AD</button>
        <button type="button" id="fs-btn" aria-label="Enter fullscreen">⛶</button>
      </div>

      <!-- Caption style drawer -->
      <div class="caption-drawer" id="caption-drawer" role="region" aria-label="Caption style settings">
        <label>
          Size
          <select id="cap-size">
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
          </select>
        </label>
        <label>
          Font
          <select id="cap-font">
            <option value="default">Default</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </select>
        </label>
        <label>
          Theme
          <select id="cap-theme">
            <option value="wob">White on Black</option>
            <option value="yob">Yellow on Black</option>
            <option value="boc">Black on Cream</option>
          </select>
        </label>
        <label>
          Track
          <select id="cap-track" class="cap-select lang-select" aria-label="Caption Language">
            <option value="en" data-lang="en">English</option>
            <option value="am" data-lang="am">Amharic (አማርኛ)</option>
            <option value="dual" data-lang="dual">Dual (EN + AM)</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="cap-live-stream" checked>
          <span>⚡ Live Stream</span>
        </label>
        <button type="button" id="cap-mic-btn" style="background:#0F172A;color:#00FF88;border:1px solid #00FF88;border-radius:4px;padding:3px 8px;font-size:12px;cursor:pointer;" aria-pressed="false" aria-label="Toggle live voice dictation">🎤 Live Voice</button>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="cap-sr-announce">
          <span>Announce to SR</span>
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" id="cap-kb-enable" checked>
          <span>Shortcuts</span>
        </label>
      </div>
    </div>

    <!-- Side panel: Transcript + Chat -->
    <div class="side-panel" id="side-panel">
      <div class="side-tabs" role="tablist" aria-label="Panel tabs">
        <button type="button" role="tab" id="tab-transcript" aria-selected="true"
                aria-controls="pane-transcript">Transcript</button>
        <button type="button" role="tab" id="tab-chat" aria-selected="false"
                aria-controls="pane-chat">Chat Replay</button>
      </div>
      <div class="tab-content">
        <!-- Transcript pane -->
        <div class="tab-pane active" id="pane-transcript" role="tabpanel" aria-labelledby="tab-transcript">
          <div class="transcript-search">
            <input type="search" id="transcript-filter" placeholder="Search transcript…" aria-label="Filter transcript">
          </div>
          <div class="transcript-list" id="transcript-list" role="list" aria-label="Transcript cues">
          </div>
        </div>
        <!-- Chat pane -->
        <div class="tab-pane" id="pane-chat" role="tabpanel" aria-labelledby="tab-chat">
          <div class="chat-list" id="chat-list" role="log" aria-live="polite" aria-label="Live session chat replay">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom action bar -->
  <div class="bottom-bar">
    <button type="button" id="braille-btn" aria-label="Braille Export — Download .brf transcript">⠿ Braille Export</button>
    <button type="button" id="offline-btn" aria-label="Offline Pack — Download 3G lesson bundle">💾 Offline Pack</button>
    <span class="download-progress" id="dl-progress" aria-live="polite"></span>
  </div>
</div>
`;

/* ================================================================
   4. WEB COMPONENT CLASS
   ================================================================ */

class DigitalBridgePlayer extends HTMLElement {

  /* ---- Observed attributes ---- */
  static get observedAttributes() {
    return [
      'src', 'src-low', 'audio-src', 'ethsl-src', 'ad-src',
      'captions-en', 'captions-am',
      'chat-log', 'lesson-title', 'poster', 'data-ad-cues'
    ];
  }

  constructor() {
    super();

    // Attach Shadow DOM
    this.attachShadow({ mode: 'open' });

    // Inject styles and HTML
    const style = document.createElement('style');
    style.textContent = COMPONENT_STYLES;
    this.shadowRoot.appendChild(style);

    const tpl = document.createElement('template');
    tpl.innerHTML = COMPONENT_HTML;
    this.shadowRoot.appendChild(tpl.content.cloneNode(true));

    /* ---- Internal state ---- */
    this._captionsEN = [];
    this._captionsAM = [];
    this._chatLog = [];
    this._captionsOn = false;
    this._captionTrack = 'en';      // 'en' | 'am' | 'dual'
    this._captionSize = 100;
    this._captionFont = 'default';
    this._captionTheme = 'wob';
    this._ethslOpen = false;
    this._adOn = false;
    this._currentPreset = 'standard';
    this._showNonSpeechBadges = false;
    this._adCues = [];               // fallback AD cues for Speech API
    this._audioCtx = null;
    this._mainGain = null;
    this._adAudio = null;
    this._adGain = null;
    this._isDraggingEthsl = false;
    this._isResizingEthsl = false;
    this._keyboardUser = false;
    this._liveSubtitleMode = true;
    this._announceCaptionsToSR = false;
    this._shortcutsDisabled = false;
    this._recognizing = false;
    this._recognition = null;
    this._srcLow = null;
    this._audioSrc = null;
    this._lastAnnouncedCaption = '';

    /* ---- Cache element references ---- */
    this.$ = (sel) => this.shadowRoot.querySelector(sel);
    this.$$ = (sel) => this.shadowRoot.querySelectorAll(sel);
  }

  /* ---- Lifecycle: connected ---- */
  connectedCallback() {
    this._cacheElements();
    this._loadPreferences();
    this._detectEnvironment();
    this._bindEvents();
    this._applyAttributes();
    this._initCanvasFallback();
    this._initEthslFallback();
    this._announceToSR('Digital Bridge player ready');
  }

  _initCanvasFallback() {
    const vid = this._els.video;
    if (this.getAttribute('src')) return;
    try {
      let mockTime = 0;
      let mockPaused = true;
      let timer = null;

      try {
        Object.defineProperty(vid, 'duration', { value: 180, configurable: true, writable: true });
        Object.defineProperty(vid, 'currentTime', {
          get: () => mockTime,
          set: (t) => {
            mockTime = Math.max(0, Math.min(180, Number(t) || 0));
            this._renderCaptions(mockTime);
            this._highlightTranscriptCue(mockTime);
            this._highlightChat(mockTime);
            this._onTimeUpdate();
          },
          configurable: true,
        });
        Object.defineProperty(vid, 'paused', {
          get: () => mockPaused,
          configurable: true,
        });

        vid.play = () => {
          mockPaused = false;
          if (!timer) {
            timer = setInterval(() => {
              if (!mockPaused) {
                mockTime = (mockTime + 0.25) % 180;
                this._onTimeUpdate();
              }
            }, 250);
          }
          return Promise.resolve();
        };

        vid.pause = () => {
          mockPaused = true;
          if (timer) { clearInterval(timer); timer = null; }
        };
      } catch (_) {}

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      let frame = 0;
      const draw = () => {
        frame++;
        ctx.fillStyle = '#0A192F';
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = '#112240';
        ctx.fillRect(0, 0, 640, 50);
        ctx.fillStyle = '#00FF88';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Digital Bridge — Accessibility Demo', 20, 32);
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < 640; x += 5) {
          const y = 180 + Math.sin((x + frame * 4) * 0.03) * 40;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#E6F1FF';
        ctx.font = '16px monospace';
        const cur = Math.floor(mockTime || 0);
        ctx.fillText(`Simulated Video Stream | ${formatTime(cur)}`, 20, 320);
        requestAnimationFrame(draw);
      };
      draw();
      if (canvas.captureStream) {
        vid.srcObject = canvas.captureStream(30);
        vid.muted = true;
      }
      this._onMetadataLoaded();
    } catch (_) {}
  }

  _initEthslFallback() {
    const ev = this._els.ethslVideo;
    const standby = this._els.ethslStandby;
    const src = this.getAttribute('ethsl-src');
    if (src) {
      if (ev) {
        ev.src = src;
        ev.style.display = 'block';
      }
      if (standby) standby.style.display = 'none';
    } else {
      // Non-Negotiable Rule 2 & 3: Never simulate fake signers with canvas.
      // Display honest standby status card pending ENAD co-design recording.
      if (ev) {
        ev.style.display = 'none';
      }
      if (standby) standby.style.display = 'flex';
    }
  }

  /* ---- Lifecycle: attribute changed ---- */
  attributeChangedCallback(name, _old, val) {
    if (!this._els) return; // not connected yet
    switch (name) {
      case 'src':         this._setSrc(val); break;
      case 'src-low':     this._srcLow = val; break;
      case 'audio-src':   this._audioSrc = val; break;
      case 'data-ad-cues':
        try { this._adCues = JSON.parse(val); } catch (_) { this._adCues = []; }
        break;
      case 'ethsl-src':   this._setEthslSrc(val); break;
      case 'ad-src':      this._setAdSrc(val); break;
      case 'captions-en': this._loadCaptions(val, 'en'); break;
      case 'captions-am': this._loadCaptions(val, 'am'); break;
      case 'chat-log':    this._loadChatLog(val); break;
      case 'lesson-title':this._setLessonTitle(val); break;
      case 'poster':      this._setPoster(val); break;
    }
  }

  /* ---- Lifecycle: disconnected ---- */
  disconnectedCallback() {
    // Clean up audio context
    if (this._audioCtx) {
      this._audioCtx.close().catch(() => {});
    }
    // Cancel any speech
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /* ================================================================
     INITIALIZATION HELPERS
     ================================================================ */

  /** Cache DOM element references for fast access. */
  _cacheElements() {
    const q = (s) => this.$(s);
    this._els = {
      root:           q('.player-root'),
      srAnnounce:     q('#sr-announce'),
      srAlert:        q('#sr-alert'),
      lessonHeading:  q('#lesson-heading'),
      video:          q('#main-video'),
      videoWrapper:   q('#video-wrapper'),
      captionOverlay: q('#caption-overlay'),
      ethslOverlay:   q('#ethsl-overlay'),
      ethslVideo:     q('#ethsl-video'),
      ethslResize:    q('#ethsl-resize'),
      kbHint:         q('#kb-hint'),
      lowbwNotice:    q('#lowbw-notice'),
      lowbwAudioBtn:  q('#lowbw-audio-btn'),
      lowbwResumeBtn: q('#lowbw-resume-btn'),
      playBtn:        q('#play-btn'),
      back10Btn:      q('#back10-btn'),
      fwd10Btn:       q('#fwd10-btn'),
      back15Btn:      q('#back15-btn'),
      fwd15Btn:       q('#fwd15-btn'),
      progressBar:    q('#progress-bar'),
      progressFill:   q('#progress-fill'),
      timeDisplay:    q('#time-display'),
      muteBtn:        q('#mute-btn'),
      volumeSlider:   q('#volume-slider'),
      captionsBtn:    q('#captions-btn'),
      capStyleBtn:    q('#caption-style-btn'),
      captionDrawer:  q('#caption-drawer'),
      capSize:        q('#cap-size'),
      capFont:        q('#cap-font'),
      capTheme:       q('#cap-theme'),
      capTrack:       q('#cap-track'),
      ethslBtn:       q('#ethsl-btn'),
      adBtn:          q('#ad-btn'),
      fsBtn:          q('#fs-btn'),
      sidePanel:      q('#side-panel'),
      tabTranscript:  q('#tab-transcript'),
      tabChat:        q('#tab-chat'),
      paneTranscript: q('#pane-transcript'),
      paneChat:       q('#pane-chat'),
      transcriptFilter: q('#transcript-filter'),
      transcriptList: q('#transcript-list'),
      chatList:       q('#chat-list'),
      brailleBtn:     q('#braille-btn'),
      offlineBtn:     q('#offline-btn'),
      dlProgress:     q('#dl-progress'),
      capLiveStream:  q('#cap-live-stream'),
      capMicBtn:      q('#cap-mic-btn'),
      capSrAnnounce:  q('#cap-sr-announce'),
      capKbEnable:    q('#cap-kb-enable'),
      ethslStandby:   q('#ethsl-standby'),
    };
  }

  /** Apply initial attribute values. */
  _applyAttributes() {
    for (const attr of DigitalBridgePlayer.observedAttributes) {
      const val = this.getAttribute(attr);
      if (val) this.attributeChangedCallback(attr, null, val);
    }
  }

  /** Load saved preferences from localStorage. */
  _loadPreferences() {
    try {
      const raw = localStorage.getItem('digital-bridge-prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.preset) this._activatePreset(prefs.preset);
        if (prefs.captionSize) { this._captionSize = prefs.captionSize; this._els.capSize.value = prefs.captionSize; }
        if (prefs.captionFont) { this._captionFont = prefs.captionFont; this._els.capFont.value = prefs.captionFont; }
        if (prefs.captionTheme) { this._captionTheme = prefs.captionTheme; this._els.capTheme.value = prefs.captionTheme; }
        if (prefs.captionTrack) { this._captionTrack = prefs.captionTrack; this._els.capTrack.value = prefs.captionTrack; }
        if (prefs.volume != null) { this._els.volumeSlider.value = prefs.volume; this._els.video.volume = prefs.volume; }
      }
    } catch (_) { /* ignore corrupt data */ }
  }

  /** Save current preferences to localStorage. */
  _savePreferences() {
    try {
      localStorage.setItem('digital-bridge-prefs', JSON.stringify({
        preset: this._currentPreset,
        captionSize: this._captionSize,
        captionFont: this._captionFont,
        captionTheme: this._captionTheme,
        captionTrack: this._captionTrack,
        volume: parseFloat(this._els.volumeSlider.value),
      }));
    } catch (_) { /* quota exceeded — ignore */ }
  }

  /** Detect user environment and auto-apply presets. */
  _detectEnvironment() {
    // High contrast
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      this._activatePreset('deaf');
    }
    // Reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Already handled by CSS @media rule; no extra JS needed
    }
    // Viewport zoom ≥ 200%
    if (window.visualViewport && window.visualViewport.scale >= 2) {
      this._activatePreset('motor');
    }
    // Keyboard-first: detect first Tab key
    const onFirstTab = (e) => {
      if (e.key === 'Tab') {
        this._keyboardUser = true;
        this.shadowRoot.removeEventListener('keydown', onFirstTab);
      }
    };
    this.shadowRoot.addEventListener('keydown', onFirstTab);
    // Slow connection
    if (navigator.connection && navigator.connection.effectiveType) {
      const slow = ['slow-2g', '2g', '3g'];
      if (slow.includes(navigator.connection.effectiveType)) {
        this._activatePreset('lowbw');
      }
    }
  }

  /* ================================================================
     EVENT BINDING
     ================================================================ */

  _bindEvents() {
    const els = this._els;
    const vid = els.video;

    /* ---- Preset buttons ---- */
    this.$$('.toolbar button[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => this._activatePreset(btn.dataset.preset));
    });

    /* ---- Play / Pause ---- */
    els.playBtn.addEventListener('click', () => this._togglePlay());
    vid.addEventListener('click', () => this._togglePlay());

    /* ---- Seek buttons ---- */
    els.back10Btn.addEventListener('click', () => this._seek(-10));
    els.fwd10Btn.addEventListener('click', () => this._seek(10));
    els.back15Btn.addEventListener('click', () => this._seek(-15));
    els.fwd15Btn.addEventListener('click', () => this._seek(15));

    /* ---- Video events ---- */
    vid.addEventListener('play', () => this._onPlayState(true));
    vid.addEventListener('pause', () => this._onPlayState(false));
    vid.addEventListener('timeupdate', () => this._onTimeUpdate());
    vid.addEventListener('loadedmetadata', () => this._onMetadataLoaded());
    vid.addEventListener('volumechange', () => this._onVolumeChange());
    vid.addEventListener('ended', () => this._onPlayState(false));

    /* ---- Progress bar click/keyboard ---- */
    els.progressBar.addEventListener('click', (e) => this._onProgressClick(e));
    els.progressBar.addEventListener('keydown', (e) => this._onProgressKeydown(e));

    /* ---- Volume ---- */
    els.muteBtn.addEventListener('click', () => this._toggleMute());
    els.volumeSlider.addEventListener('input', () => {
      vid.volume = parseFloat(els.volumeSlider.value);
      vid.muted = false;
      this._savePreferences();
    });

    /* ---- Captions ---- */
    els.captionsBtn.addEventListener('click', () => this._toggleCaptions());

    /* ---- Caption style drawer ---- */
    els.capStyleBtn.addEventListener('click', () => this._toggleCaptionDrawer());
    els.capSize.addEventListener('change', () => { this._captionSize = parseInt(els.capSize.value); this._savePreferences(); });
    els.capFont.addEventListener('change', () => { this._captionFont = els.capFont.value; this._savePreferences(); });
    els.capTheme.addEventListener('change', () => { this._captionTheme = els.capTheme.value; this._savePreferences(); });
    els.capTrack.addEventListener('change', () => {
      this._captionTrack = els.capTrack.value;
      this._buildTranscript();
      this._renderCaptions(this._els.video.currentTime || 0);
      this._savePreferences();
    });
    if (els.capLiveStream) {
      els.capLiveStream.addEventListener('change', () => {
        this._liveSubtitleMode = els.capLiveStream.checked;
        this._renderCaptions(this._els.video.currentTime || 0);
      });
    }
    if (els.capMicBtn) {
      els.capMicBtn.addEventListener('click', () => this._toggleVoiceDictation());
    }
    if (els.capSrAnnounce) {
      els.capSrAnnounce.addEventListener('change', () => {
        this._announceCaptionsToSR = els.capSrAnnounce.checked;
        if (els.captionOverlay) {
          els.captionOverlay.setAttribute('aria-live', this._announceCaptionsToSR ? 'polite' : 'off');
          els.captionOverlay.setAttribute('aria-hidden', this._announceCaptionsToSR ? 'false' : 'true');
        }
      });
    }
    if (els.capKbEnable) {
      els.capKbEnable.addEventListener('change', () => {
        this._shortcutsDisabled = !els.capKbEnable.checked;
      });
    }

    /* ---- EthSL ---- */
    els.ethslBtn.addEventListener('click', () => this._toggleEthsl());
    this._setupEthslDrag();
    this._setupEthslResize();
    this._setupEthslKeyboard();
    this.$$('.ethsl-dock-bar button[data-dock]').forEach(btn => {
      btn.addEventListener('click', () => this._dockEthsl(btn.dataset.dock));
    });

    /* ---- Audio Description ---- */
    els.adBtn.addEventListener('click', () => this._toggleAD());

    /* ---- Fullscreen ---- */
    els.fsBtn.addEventListener('click', () => this._toggleFullscreen());

    /* ---- Side panel tabs ---- */
    els.tabTranscript.addEventListener('click', () => this._switchTab('transcript'));
    els.tabChat.addEventListener('click', () => this._switchTab('chat'));

    /* ---- Transcript filter ---- */
    els.transcriptFilter.addEventListener('input', () => this._filterTranscript());

    /* ---- Braille export ---- */
    els.brailleBtn.addEventListener('click', () => this._exportBraille());

    /* ---- Offline pack ---- */
    els.offlineBtn.addEventListener('click', () => this._downloadOfflinePack());

    /* ---- Low-BW actions ---- */
    els.lowbwAudioBtn.addEventListener('click', () => {
      if (this._audioSrc) {
        const cur = vid.currentTime;
        vid.src = this._audioSrc;
        vid.currentTime = cur;
      }
      vid.play().catch(() => {});
      this._announceToSR('Playing lightweight Opus audio stream');
    });
    els.lowbwResumeBtn.addEventListener('click', () => {
      this._activatePreset('standard');
      vid.play().catch(() => {});
    });

    /* ---- Keyboard shortcuts (when player root or document has focus) ---- */
    this.tabIndex = 0;
    this.addEventListener('keydown', (e) => this._onShortcutKey(e));
    this.shadowRoot.addEventListener('keydown', (e) => this._onShortcutKey(e));
    els.root.addEventListener('keydown', (e) => this._onShortcutKey(e));
    window.addEventListener('keydown', (e) => {
      const activeTag = ((e.target && e.target.tagName) || (document.activeElement && document.activeElement.tagName) || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      this._onShortcutKey(e);
    });

    /* ---- Show keyboard hint ---- */
    els.videoWrapper.addEventListener('focusin', () => {
      els.kbHint.classList.add('show');
      clearTimeout(this._kbHintTimer);
      this._kbHintTimer = setTimeout(() => els.kbHint.classList.remove('show'), 4000);
    });
  }

  /* ================================================================
     VIDEO SOURCE & METADATA
     ================================================================ */

  _setSrc(url) {
    if (!url) return;
    this._els.video.src = url;
  }

  _setPoster(url) {
    if (!url) return;
    this._els.video.poster = url;
  }

  _setLessonTitle(title) {
    this._els.lessonHeading.textContent = title || '';
  }

  _onMetadataLoaded() {
    const vid = this._els.video;
    const dur = (isFinite(vid.duration) && vid.duration > 0) ? Math.floor(vid.duration) : 180;
    const cur = (isFinite(vid.currentTime) && vid.currentTime >= 0) ? Math.floor(vid.currentTime) : 0;
    this._els.timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    this._els.progressBar.setAttribute('aria-valuemax', String(dur));
    this._els.progressBar.setAttribute('aria-valuenow', String(cur));
    this._announceToSR(`Video loaded. Duration: ${formatTime(dur)}`);
  }

  /* ================================================================
     PLAYBACK CONTROLS
     ================================================================ */

  _togglePlay() {
    const vid = this._els.video;
    if (vid.paused || vid.ended) {
      vid.play().catch(() => {});
      this._onPlayState(true);
    } else {
      vid.pause();
      this._onPlayState(false);
    }
  }

  _onPlayState(playing) {
    this._els.playBtn.textContent = playing ? '⏸' : '▶';
    this._els.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    this._els.playBtn.setAttribute('aria-pressed', String(playing));

    // Sync EthSL video
    if (this._ethslOpen) {
      const ev = this._els.ethslVideo;
      if (playing) ev.play().catch(() => {});
      else ev.pause();
    }

    this._announceToSR(playing ? 'Playing' : 'Paused');
  }

  _seek(delta) {
    const vid = this._els.video;
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + delta));
    this._syncEthsl();
    this._announceToSR(`Seeked ${delta > 0 ? 'forward' : 'back'} ${Math.abs(delta)} seconds`);
  }

  _onTimeUpdate() {
    const vid = this._els.video;
    const dur = (isFinite(vid.duration) && vid.duration > 0) ? vid.duration : 180;
    const cur = (isFinite(vid.currentTime) && vid.currentTime >= 0) ? vid.currentTime : 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    this._els.progressFill.style.width = `${pct}%`;
    this._els.progressBar.setAttribute('aria-valuenow', String(Math.floor(cur)));
    this._els.progressBar.setAttribute('aria-valuemax', String(Math.floor(dur)));
    this._els.timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;

    // Update captions
    if (this._captionsOn) this._renderCaptions(vid.currentTime);

    // Update transcript highlight
    this._highlightTranscriptCue(vid.currentTime);

    // Update chat highlight
    if (this._chatLog.length) this._highlightChatMsg(vid.currentTime);

    // AD Speech fallback timing
    if (this._adOn && !this.getAttribute('ad-src') && this._adCues.length) {
      this._speakADCue(vid.currentTime);
    }
  }

  /* ---- Progress bar interaction ---- */
  _onProgressClick(e) {
    const rect = this._els.progressBar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vid = this._els.video;
    vid.currentTime = frac * (vid.duration || 0);
    this._syncEthsl();
  }

  _onProgressKeydown(e) {
    const vid = this._els.video;
    const step = 5;
    if (e.key === 'ArrowRight') { this._seek(step); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { this._seek(-step); e.preventDefault(); }
  }

  /* ---- Volume / Mute ---- */
  _toggleMute() {
    const vid = this._els.video;
    vid.muted = !vid.muted;
  }

  _onVolumeChange() {
    const vid = this._els.video;
    this._els.muteBtn.textContent = vid.muted || vid.volume === 0 ? '🔇' : '🔊';
    this._els.muteBtn.setAttribute('aria-pressed', String(vid.muted));
    this._els.muteBtn.setAttribute('aria-label', vid.muted ? 'Unmute' : 'Mute');
  }

  /* ---- Fullscreen ---- */
  _toggleFullscreen() {
    const root = this._els.root;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      this._els.fsBtn.textContent = '⛶';
      this._els.fsBtn.setAttribute('aria-label', 'Enter fullscreen');
    } else {
      root.requestFullscreen().catch(() => {});
      this._els.fsBtn.textContent = '⛶';
      this._els.fsBtn.setAttribute('aria-label', 'Exit fullscreen');
    }
  }

  /* ================================================================
     KEYBOARD SHORTCUTS
     ================================================================ */

  _onShortcutKey(e) {
    if (e._handledByPlayer) return;
    e._handledByPlayer = true;

    // Only activate if not inside an input/select
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (this._shortcutsDisabled && e.key.length === 1 && e.key !== ' ') return;

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        this._togglePlay();
        break;
      case 'j':
      case 'J':
        e.preventDefault();
        this._seek(-10);
        break;
      case 'l':
      case 'L':
        e.preventDefault();
        this._seek(10);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        this._toggleMute();
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        this._toggleCaptions();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        this._toggleEthsl();
        break;
      case 'a':
      case 'A':
        e.preventDefault();
        this._toggleAD();
        break;
    }
  }

  /* ================================================================
     CAPTION SYSTEM
     ================================================================ */

  /** Load a .vtt file and parse it. */
  async _loadCaptions(url, lang) {
    if (!url) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      const text = await resp.text();
      const cues = parseVTT(text);
      if (lang === 'en') this._captionsEN = cues;
      else if (lang === 'am') this._captionsAM = cues;
      this._buildTranscript();
    } catch (err) {
      console.warn(`[digital-bridge-player] Failed to load ${lang} captions:`, err);
    }
  }

  _toggleCaptions() {
    this._captionsOn = !this._captionsOn;
    this._els.captionsBtn.setAttribute('aria-pressed', String(this._captionsOn));
    if (!this._captionsOn) {
      this._els.captionOverlay.innerHTML = '';
      this._els.captionOverlay.style.display = 'none';
      this.removeAttribute('data-captions-enabled');
      this.classList.remove('captions-enabled');
    } else {
      this._els.captionOverlay.style.display = 'block';
      this.setAttribute('data-captions-enabled', 'true');
      this.classList.add('captions-enabled');
      this._renderCaptions(this._els.video.currentTime || 0);
    }
    this._announceToSR(`Captions ${this._captionsOn ? 'on' : 'off'}`);
    this._savePreferences();
  }

  _toggleCaptionDrawer() {
    const drawer = this._els.captionDrawer;
    const open = drawer.classList.toggle('open');
    this._els.capStyleBtn.setAttribute('aria-expanded', String(open));
  }

  _formatLiveCueText(cue, time) {
    let text = cue.text;
    if (this._liveSubtitleMode) {
      const duration = Math.max(0.3, cue.endTime - cue.startTime);
      const elapsed = Math.max(0, time - cue.startTime);
      const words = text.trim().split(/\s+/);
      const fraction = Math.min(1.0, elapsed / duration);
      const count = Math.max(1, Math.ceil(fraction * words.length));
      const partial = words.slice(0, count).join(' ');
      const isComplete = count >= words.length;
      const isPaused = this._els.video && this._els.video.paused;
      const cursor = (!isComplete && !isPaused) ? ' <span class="live-cursor" aria-hidden="true">▌</span>' : '';
      text = partial + cursor;
    }
    return this._renderCueText(text);
  }

  _toggleVoiceDictation() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this._announceToSR('Speech recognition API not supported in this browser. Running synchronized live subtitle stream.');
      return;
    }
    if (this._recognizing) {
      if (this._recognition) this._recognition.stop();
      this._recognizing = false;
      if (this._els.capMicBtn) {
        this._els.capMicBtn.setAttribute('aria-pressed', 'false');
        this._els.capMicBtn.textContent = '🎤 Live Voice';
      }
      this._announceToSR('Live voice dictation stopped');
    } else {
      try {
        this._recognition = new SpeechRec();
        this._recognition.continuous = true;
        this._recognition.interimResults = true;
        this._recognition.lang = this._captionTrack === 'am' ? 'am-ET' : 'en-US';
        this._recognition.onresult = (e) => {
          let text = '';
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            text += e.results[i][0].transcript;
          }
          if (text) this._handleLiveVoiceResult(text);
        };
        this._recognition.onerror = () => {
          this._recognizing = false;
          if (this._els.capMicBtn) {
            this._els.capMicBtn.setAttribute('aria-pressed', 'false');
            this._els.capMicBtn.textContent = '🎤 Live Voice';
          }
        };
        this._recognition.start();
        this._recognizing = true;
        if (this._els.capMicBtn) {
          this._els.capMicBtn.setAttribute('aria-pressed', 'true');
          this._els.capMicBtn.textContent = '⏹ Stop Dictation';
        }
        this._announceToSR('Live voice dictation active');
      } catch (err) {
        console.warn('SpeechRecognition error:', err);
      }
    }
  }

  _handleLiveVoiceResult(text) {
    if (!this._captionsOn) this._toggleCaptions();
    const overlay = this._els.captionOverlay;
    if (overlay) {
      overlay.innerHTML = `
        <div class="live-subtitle-badge" aria-hidden="true"><span class="live-badge-dot"></span> 🎤 VOICE DICTATION</div>
        <div class="caption-line theme-${this._captionTheme}">${this._escapeHTML(text)} <span class="live-cursor">▌</span></div>
      `;
    }
  }

  /** Render active caption cues for the given time. */
  _renderCaptions(time) {
    const overlay = this._els.captionOverlay;
    const track = this._captionTrack;
    const showEN = track === 'en' || track === 'dual';
    const showAM = track === 'am' || track === 'dual';

    const activeEN = showEN ? this._captionsEN.filter(c => time >= c.startTime && time <= c.endTime) : [];
    const activeAM = showAM ? this._captionsAM.filter(c => time >= c.startTime && time <= c.endTime) : [];

    // Build HTML
    let html = '';
    const themeClass = `theme-${this._captionTheme}`;
    const fontStyle = this._captionFont === 'serif' ? "font-family:'Georgia','Noto Serif Ethiopic',serif;"
                    : this._captionFont === 'mono'  ? "font-family:'Consolas','Noto Sans Ethiopic',monospace;"
                    : "font-family:'Segoe UI','Noto Sans Ethiopic',system-ui,sans-serif;";
    const fontSize = `font-size:${this._captionSize}%;`;

    if (this._liveSubtitleMode && (activeEN.length || activeAM.length)) {
      html += `<div class="live-subtitle-badge" aria-hidden="true"><span class="live-badge-dot"></span> LIVE · በቀጥታ የትርጉም ጽሑፍ</div>`;
    }
    for (const cue of activeEN) {
      html += `<div class="caption-line ${themeClass}" style="${fontStyle}${fontSize}" lang="en">${this._formatLiveCueText(cue, time)}</div>`;
    }
    for (const cue of activeAM) {
      html += `<div class="caption-line ${themeClass}" style="${fontStyle}${fontSize} line-height: 1.7;" lang="am">${this._formatLiveCueText(cue, time)}</div>`;
    }

    overlay.innerHTML = html;

    if (this._announceCaptionsToSR && (activeEN.length || activeAM.length)) {
      const announceText = activeAM.length ? activeAM.map(c => c.text).join(' ') : activeEN.map(c => c.text).join(' ');
      if (announceText !== this._lastAnnouncedCaption) {
        this._lastAnnouncedCaption = announceText;
        this._announceToSR(announceText);
      }
    }
  }

  /**
   * Render cue text, converting bracketed non-speech markers into badges.
   * E.g. [Music] → <span class="sound-badge">[Music]</span>
   */
  _renderCueText(text) {
    // Sanitize HTML first
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (this._showNonSpeechBadges) {
      return safe.replace(
        /\[(Music|Applause|Alert|Laughter|Silence|Sound|Noise|Cheering|Clapping|ሙዚቃ|ጭብጨባ|ሳቅ|ዝምታ|ድምጽ|ደስ የሚል የመግቢያ ሙዚቃ|ደስ የሚል የማጠቃለያ ሙዚቃ)\]/gi,
        (m) => `<span class="sound-badge">${m}</span>`
      );
    }
    return safe;
  }

  /* ================================================================
     EthSL SIGN LANGUAGE OVERLAY
     ================================================================ */

  _setEthslSrc(url) {
    if (!url) return;
    this._els.ethslVideo.src = url;
  }

  _toggleEthsl() {
    this._ethslOpen = !this._ethslOpen;
    this._els.ethslOverlay.classList.toggle('open', this._ethslOpen);
    this._els.ethslBtn.setAttribute('aria-pressed', String(this._ethslOpen));

    if (this._ethslOpen) {
      this._syncEthsl();
      if (!this._els.video.paused) this._els.ethslVideo.play().catch(() => {});
      // Default dock position
      if (!this._els.ethslOverlay.style.width) {
        this._dockEthsl('br');
      }
    } else {
      this._els.ethslVideo.pause();
    }

    this._announceToSR(`Sign language overlay ${this._ethslOpen ? 'opened' : 'closed'}`);
  }

  /** Sync EthSL video to main video currentTime. */
  _syncEthsl() {
    const ev = this._els.ethslVideo;
    const vid = this._els.video;
    if (Math.abs(ev.currentTime - vid.currentTime) > 0.3) {
      ev.currentTime = vid.currentTime;
    }
    ev.playbackRate = vid.playbackRate;
  }

  /** Dock the EthSL overlay to a preset position. */
  _dockEthsl(position) {
    const overlay = this._els.ethslOverlay;
    const wrapper = this._els.videoWrapper;
    const wRect = wrapper.getBoundingClientRect();
    const w = Math.max(160, wRect.width * 0.28);
    const h = w * 0.75; // 4:3 ratio

    overlay.style.transition = 'all 0.2s ease';
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;

    switch (position) {
      case 'tl':
        overlay.style.top = '8px';
        overlay.style.left = '8px';
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';
        break;
      case 'tr':
        overlay.style.top = '8px';
        overlay.style.right = '8px';
        overlay.style.left = 'auto';
        overlay.style.bottom = 'auto';
        break;
      case 'bl':
        overlay.style.bottom = '68px';
        overlay.style.left = '8px';
        overlay.style.top = 'auto';
        overlay.style.right = 'auto';
        break;
      case 'br':
        overlay.style.bottom = '68px';
        overlay.style.right = '8px';
        overlay.style.top = 'auto';
        overlay.style.left = 'auto';
        break;
      case 'sbs':
        // Side-by-side: left half for main, right half for EthSL
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.left = 'auto';
        overlay.style.bottom = 'auto';
        overlay.style.width = '50%';
        overlay.style.height = '100%';
        break;
    }

    // Clear transition after animation
    setTimeout(() => { overlay.style.transition = ''; }, 250);
    this._announceToSR(`Sign language window docked: ${position}`);
  }

  /** Setup pointer-based dragging for EthSL overlay. */
  _setupEthslDrag() {
    const overlay = this._els.ethslOverlay;
    let startX, startY, origLeft, origTop;

    const onPointerDown = (e) => {
      // Ignore if on resize handle or dock bar
      if (e.target.closest('.resize-handle') || e.target.closest('.ethsl-dock-bar')) return;
      this._isDraggingEthsl = true;
      overlay.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = overlay.getBoundingClientRect();
      const parentRect = this._els.videoWrapper.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;
      overlay.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!this._isDraggingEthsl) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      overlay.style.left = `${origLeft + dx}px`;
      overlay.style.top = `${origTop + dy}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
    };

    const onPointerUp = (e) => {
      if (!this._isDraggingEthsl) return;
      this._isDraggingEthsl = false;
      overlay.style.cursor = 'grab';
      overlay.releasePointerCapture(e.pointerId);
    };

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
  }

  /** Setup pointer-based resizing for EthSL overlay (via resize handle). */
  _setupEthslResize() {
    const handle = this._els.ethslResize;
    const overlay = this._els.ethslOverlay;
    let startX, startY, origW, origH;

    const onPointerDown = (e) => {
      this._isResizingEthsl = true;
      startX = e.clientX;
      startY = e.clientY;
      origW = overlay.offsetWidth;
      origH = overlay.offsetHeight;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerMove = (e) => {
      if (!this._isResizingEthsl) return;
      const wrapperRect = this._els.videoWrapper.getBoundingClientRect();
      let newW = origW + (e.clientX - startX);
      let newH = origH + (e.clientY - startY);
      newW = Math.max(160, Math.min(newW, wrapperRect.width - 10));
      newH = Math.max(120, Math.min(newH, wrapperRect.height - 10));
      overlay.style.width = `${newW}px`;
      overlay.style.height = `${newH}px`;
    };

    const onPointerUp = (e) => {
      this._isResizingEthsl = false;
      handle.releasePointerCapture(e.pointerId);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
  }

  /** Keyboard-based move/resize for EthSL overlay. */
  _setupEthslKeyboard() {
    const overlay = this._els.ethslOverlay;
    overlay.addEventListener('keydown', (e) => {
      if (!this._ethslOpen) return;
      const step = 10;
      const isResize = e.shiftKey;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();

        if (isResize) {
          // Resize with Shift+Arrow
          let w = overlay.offsetWidth;
          let h = overlay.offsetHeight;
          if (e.key === 'ArrowRight') w += step;
          if (e.key === 'ArrowLeft') w -= step;
          if (e.key === 'ArrowDown') h += step;
          if (e.key === 'ArrowUp') h -= step;
          w = Math.max(160, w);
          h = Math.max(120, h);
          overlay.style.width = `${w}px`;
          overlay.style.height = `${h}px`;
        } else {
          // Move with Arrow keys
          const parentRect = this._els.videoWrapper.getBoundingClientRect();
          const rect = overlay.getBoundingClientRect();
          let left = rect.left - parentRect.left;
          let top = rect.top - parentRect.top;
          if (e.key === 'ArrowRight') left += step;
          if (e.key === 'ArrowLeft') left -= step;
          if (e.key === 'ArrowDown') top += step;
          if (e.key === 'ArrowUp') top -= step;
          overlay.style.left = `${left}px`;
          overlay.style.top = `${top}px`;
          overlay.style.right = 'auto';
          overlay.style.bottom = 'auto';
        }
      }
    });
  }

  /* ================================================================
     AUDIO DESCRIPTION
     ================================================================ */

  _setAdSrc(url) {
    if (!url) return;
    // We will create the audio element & Web Audio nodes when AD is toggled on
    this._adSrcUrl = url;
  }

  _toggleAD() {
    this._adOn = !this._adOn;
    this._els.adBtn.setAttribute('aria-pressed', String(this._adOn));

    if (this._adOn) {
      if (this._adSrcUrl || this.getAttribute('ad-src')) {
        this._enableADTrack();
      } else {
        this._enableADSpeech();
      }
    } else {
      this._disableAD();
    }

    this._announceToSR(`Audio description ${this._adOn ? 'enabled' : 'disabled'}`);
  }

  /** Enable AD via a separate audio track + Web Audio API ducking. */
  _enableADTrack() {
    const vid = this._els.video;
    const src = this._adSrcUrl || this.getAttribute('ad-src');
    if (!src) return;

    // Initialise Web Audio context if needed
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Connect main video through a gain node
      const source = this._audioCtx.createMediaElementSource(vid);
      this._mainGain = this._audioCtx.createGain();
      source.connect(this._mainGain);
      this._mainGain.connect(this._audioCtx.destination);
    }

    // Create AD audio element
    if (!this._adAudio) {
      this._adAudio = new Audio();
      this._adAudio.src = src;
      this._adAudio.preload = 'auto';
      const adSource = this._audioCtx.createMediaElementSource(this._adAudio);
      this._adGain = this._audioCtx.createGain();
      adSource.connect(this._adGain);
      this._adGain.connect(this._audioCtx.destination);
    }

    // Duck main audio
    this._mainGain.gain.value = 0.2;
    this._adGain.gain.value = 1.0;

    // Sync AD audio to video
    this._adAudio.currentTime = vid.currentTime;
    if (!vid.paused) this._adAudio.play().catch(() => {});

    // Keep them in sync
    this._adSyncHandler = () => {
      if (this._adAudio && this._adOn) {
        if (Math.abs(this._adAudio.currentTime - vid.currentTime) > 0.5) {
          this._adAudio.currentTime = vid.currentTime;
        }
      }
    };
    vid.addEventListener('timeupdate', this._adSyncHandler);
    vid.addEventListener('seeked', this._adSyncHandler);
    vid.addEventListener('play', this._adPlayHandler = () => { if (this._adAudio) this._adAudio.play().catch(() => {}); });
    vid.addEventListener('pause', this._adPauseHandler = () => { if (this._adAudio) this._adAudio.pause(); });
  }

  /** Fallback: use Speech API to read AD cues from data-ad-cues attribute or empty. */
  _enableADSpeech() {
    // Try to parse AD cues from data-ad-cues attribute (JSON array of {time, text})
    try {
      const raw = this.getAttribute('data-ad-cues');
      if (raw) this._adCues = JSON.parse(raw);
    } catch (_) { this._adCues = []; }
    this._lastSpokenADIndex = -1;
  }

  /** Speak an AD cue at the right time using Web Speech API. */
  _speakADCue(time) {
    if (!window.speechSynthesis || !this._adCues.length) return;
    for (let i = 0; i < this._adCues.length; i++) {
      const cue = this._adCues[i];
      if (i > this._lastSpokenADIndex && time >= cue.time && time < cue.time + 1) {
        this._lastSpokenADIndex = i;
        const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
        const localVoice = voices.find(v => v.localService === true) || voices[0];

        // Extended AD: pause video if text is long (> 50 chars) so learner hears full description
        const vid = this._els.video;
        const shouldExtendedPause = cue.text.length > 50 && vid && !vid.paused;
        if (shouldExtendedPause) {
          vid.pause();
        }

        const utt = new SpeechSynthesisUtterance(cue.text);
        if (localVoice) utt.voice = localVoice;
        utt.rate = 1.1;
        utt.volume = 1.0;
        utt.onend = () => {
          if (shouldExtendedPause && vid && vid.paused) {
            vid.play().catch(() => {});
          }
        };
        speechSynthesis.speak(utt);
        break;
      }
    }
  }

  /** Disable AD. */
  _disableAD() {
    // Restore main gain
    if (this._mainGain) this._mainGain.gain.value = 1.0;
    // Stop AD audio
    if (this._adAudio) {
      this._adAudio.pause();
    }
    // Remove sync handlers
    const vid = this._els.video;
    if (this._adSyncHandler) {
      vid.removeEventListener('timeupdate', this._adSyncHandler);
      vid.removeEventListener('seeked', this._adSyncHandler);
    }
    if (this._adPlayHandler) vid.removeEventListener('play', this._adPlayHandler);
    if (this._adPauseHandler) vid.removeEventListener('pause', this._adPauseHandler);
    // Cancel speech
    if (window.speechSynthesis) speechSynthesis.cancel();
    this._lastSpokenADIndex = -1;
  }

  /* ================================================================
     INTERACTIVE TRANSCRIPT
     ================================================================ */

  /** Build transcript list from loaded caption cues. */
  _buildTranscript() {
    const list = this._els.transcriptList;
    if (!list) return;
    list.innerHTML = '';

    const track = this._captionTrack || 'en';
    let cues = [];
    if (track === 'am') {
      cues = this._captionsAM.length ? this._captionsAM : this._captionsEN;
    } else if (track === 'dual') {
      cues = this._captionsEN.length ? this._captionsEN : this._captionsAM;
    } else {
      cues = this._captionsEN.length ? this._captionsEN : this._captionsAM;
    }

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const btn = document.createElement('button');
      btn.className = 'transcript-cue';
      btn.setAttribute('role', 'listitem');
      btn.dataset.index = i;
      btn.dataset.start = cue.startTime;
      btn.tabIndex = (i === 0) ? 0 : -1;

      let displayText = this._escapeHTML(cue.text);
      if (track === 'dual' && this._captionsAM[i]) {
        displayText += `<div style="font-size:0.85em; color:var(--text-muted); margin-top:3px; line-height:1.4;">${this._escapeHTML(this._captionsAM[i].text)}</div>`;
      }

      const seekTime = (cue.startTime != null) ? cue.startTime : (cue.start != null) ? cue.start : 0;
      btn.innerHTML = `
        <span class="transcript-time">${formatTime(seekTime)}</span>
        <div class="transcript-text">${displayText}</div>
      `;
      btn.addEventListener('click', () => this._seekToCue(seekTime));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._seekToCue(cue.startTime);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = btn.nextElementSibling;
          if (next && next.classList.contains('transcript-cue')) {
            btn.tabIndex = -1;
            next.tabIndex = 0;
            next.focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = btn.previousElementSibling;
          if (prev && prev.classList.contains('transcript-cue')) {
            btn.tabIndex = -1;
            prev.tabIndex = 0;
            prev.focus();
          }
        }
      });
      list.appendChild(btn);
    }
  }

  /** Seek to a cue's start time. */
  _seekToCue(time) {
    this._els.video.currentTime = time;
    this._syncEthsl();
    this._announceToSR(`Seeked to ${formatTime(time)}`);
  }

  /** Highlight and auto-scroll the active transcript cue. */
  _highlightTranscriptCue(time) {
    const cueEls = this._els.transcriptList.querySelectorAll('.transcript-cue');
    let activeEl = null;
    for (const el of cueEls) {
      const start = parseFloat(el.dataset.start);
      const cues = this._captionsEN.length ? this._captionsEN : this._captionsAM;
      const idx = parseInt(el.dataset.index);
      const cue = cues[idx];
      if (cue && time >= cue.startTime && time <= cue.endTime) {
        el.classList.add('active');
        el.tabIndex = 0;
        activeEl = el;
      } else {
        el.classList.remove('active');
        el.tabIndex = -1;
      }
    }
    // Auto-scroll into view
    if (activeEl && !this._transcriptUserScrolling) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /** Filter transcript by search text. */
  _filterTranscript() {
    const query = this._els.transcriptFilter.value.toLowerCase();
    const cueEls = this._els.transcriptList.querySelectorAll('.transcript-cue');
    for (const el of cueEls) {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(query) ? '' : 'none';
    }
  }

  /* ================================================================
     CHAT REPLAY
     ================================================================ */

  async _loadChatLog(url) {
    if (!url) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      this._chatLog = await resp.json();
      this._buildChatList();
    } catch (err) {
      console.warn('[digital-bridge-player] Failed to load chat log:', err);
    }
  }

  /** Render all chat messages. */
  _buildChatList() {
    const list = this._els.chatList;
    list.innerHTML = '';
    for (let i = 0; i < this._chatLog.length; i++) {
      const msg = this._chatLog[i];
      const btn = document.createElement('button');
      btn.className = 'chat-msg';
      btn.dataset.time = msg.time;
      btn.dataset.index = i;
      btn.innerHTML = `
        <span class="chat-msg-meta">
          <span class="chat-msg-user">${this._escapeHTML(msg.user)}</span>
          <span>${formatTime(msg.time)}</span>
        </span>
        <span>${this._escapeHTML(msg.message)}</span>
      `;
      btn.addEventListener('click', () => this._seekToCue(msg.time));
      list.appendChild(btn);
    }
  }

  /** Highlight current chat messages based on video time. */
  _highlightChatMsg(time) {
    const msgEls = this._els.chatList.querySelectorAll('.chat-msg');
    let activeEl = null;
    for (const el of msgEls) {
      const msgTime = parseFloat(el.dataset.time);
      // Show as active if within 5 seconds after message time
      if (time >= msgTime && time < msgTime + 5) {
        el.classList.add('active');
        activeEl = el;
      } else {
        el.classList.remove('active');
      }
    }
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ================================================================
     SIDE PANEL TABS
     ================================================================ */

  _switchTab(tab) {
    const els = this._els;
    if (tab === 'transcript') {
      els.tabTranscript.setAttribute('aria-selected', 'true');
      els.tabChat.setAttribute('aria-selected', 'false');
      els.paneTranscript.classList.add('active');
      els.paneChat.classList.remove('active');
    } else {
      els.tabChat.setAttribute('aria-selected', 'true');
      els.tabTranscript.setAttribute('aria-selected', 'false');
      els.paneChat.classList.add('active');
      els.paneTranscript.classList.remove('active');
    }
  }

  /* ================================================================
     ADAPTIVE PRESETS
     ================================================================ */

  _activatePreset(preset) {
    this._currentPreset = preset;

    // Update toolbar button states
    this.$$('.toolbar button[data-preset]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.preset === preset ? 'true' : 'false');
    });

    // Reset host classes
    this.classList.remove('motor');
    this.classList.remove('simplified');
    this.classList.remove('ad-enabled');
    this.removeAttribute('data-ad-enabled');
    this.removeAttribute('data-simplified');
    this._els.root.classList.remove('simplified');

    // Reset low-BW notice
    this._els.lowbwNotice.classList.remove('active');

    // Reset non-speech badges
    this._showNonSpeechBadges = false;

    switch (preset) {
      case 'standard':
        this._applyStandard();
        break;
      case 'deaf':
        this._applyDeaf();
        break;
      case 'blind':
        this._applyBlind();
        break;
      case 'motor':
        this._applyMotor();
        break;
      case 'lowbw':
        this._applyLowBW();
        break;
    }

    this._savePreferences();
    this._announceToSR(`Preset activated: ${preset}`);
  }

  _applyStandard() {
    // Balanced defaults
  }

  _applyDeaf() {
    // Enable captions if not already
    if (!this._captionsOn) this._toggleCaptions();
    // Set to dual track, large font
    this._captionTrack = 'dual';
    this._captionSize = 150;
    this._els.capTrack.value = 'dual';
    this._els.capSize.value = '150';
    // Enable non-speech sound badges
    this._showNonSpeechBadges = true;
    // Open EthSL overlay
    if (!this._ethslOpen) {
      this._toggleEthsl();
    }
  }

  _applyBlind() {
    // Activate AD
    if (!this._adOn) this._toggleAD();
    this.setAttribute('data-ad-enabled', 'true');
    this.classList.add('ad-enabled');
    this.setAttribute('data-simplified', 'true');
    this.classList.add('simplified');
    this._els.root.classList.add('simplified');
    // Focus on semantic heading
    this._els.lessonHeading.focus();
    // Announce
    this._announceToSR('Blind / Screen Reader mode active. Audio description enabled. Use keyboard shortcuts to control playback.', true);
  }

  _applyMotor() {
    // Add motor class for larger touch targets
    this.classList.add('motor');
    // Announce
    this._announceToSR('One-Hand / Motor mode active. Larger buttons and single-key shortcuts enabled.');
  }

  _applyLowBW() {
    // Pause video, show low-bw notice
    this._els.video.pause();
    this._els.lowbwNotice.classList.add('active');
    // Announce
    this._announceToSR('Low bandwidth mode. Video paused to save data. Use Audio Only or read the transcript.');
  }

  /* ================================================================
     BRAILLE EXPORT
     ================================================================ */

  _exportBraille() {
    // Collect all transcript text
    const cues = this._captionsEN.length ? this._captionsEN : this._captionsAM;
    if (!cues.length) {
      this._announceToSR('No transcript available for Braille export');
      return;
    }

    let text = '';
    for (const cue of cues) {
      text += `${formatTime(cue.startTime)} ${cue.text}\n`;
    }

    const brf = textToBrf(text);
    const blob = new Blob([brf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.brf';
    a.click();
    URL.revokeObjectURL(url);

    this._announceToSR('Braille transcript downloaded');
  }

  /* ================================================================
     OFFLINE PACK DOWNLOAD
     ================================================================ */

  async _downloadOfflinePack() {
    const dlProgress = this._els.dlProgress;
    dlProgress.textContent = 'Preparing…';

    // Prepare transcript text
    const enText = this._captionsEN.map(c => `${formatTime(c.startTime)} - ${formatTime(c.endTime)}\n${c.text}`).join('\n\n');
    const amText = this._captionsAM.map(c => `${formatTime(c.startTime)} - ${formatTime(c.endTime)}\n${c.text}`).join('\n\n');

    const bundlePayload = {
      title: this.getAttribute('lesson-title') || 'Web Accessibility 101',
      transcript_en: enText || 'Introduction to Web Accessibility Lesson Transcript',
      transcript_am: amText || 'የድር ተደራሽነት መግቢያ ትምህርት ሙሉ ጽሑፍ',
      include_audio: true,
      include_pdf: true
    };

    // Attempt server bundle first (via nginx /api/bundle or direct :8000 backend)
    for (const endpoint of ['/api/bundle', 'http://localhost:8000/api/bundle']) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bundlePayload)
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'digital-bridge-offline-pack.zip';
          a.click();
          URL.revokeObjectURL(url);
          dlProgress.textContent = 'Server bundle downloaded!';
          this._announceToSR('Offline pack downloaded from server');
          return;
        }
      } catch (_) {
        // Fall through to next endpoint or client-side fallback
      }
    }

    // Client-side fallback: build a ZIP with transcript
    dlProgress.textContent = 'Building offline pack…';
    const zip = new MiniZip();

    // Add transcript text files
    if (this._captionsEN.length) {
      let text = '';
      for (const c of this._captionsEN) text += `${formatTime(c.startTime)} - ${formatTime(c.endTime)}\n${c.text}\n\n`;
      zip.addFile('transcript-en.txt', text);
    }
    if (this._captionsAM.length) {
      let text = '';
      for (const c of this._captionsAM) text += `${formatTime(c.startTime)} - ${formatTime(c.endTime)}\n${c.text}\n\n`;
      zip.addFile('transcript-am.txt', text);
    }

    // Add chat log if available
    if (this._chatLog.length) {
      let chatText = '';
      for (const m of this._chatLog) chatText += `[${formatTime(m.time)}] ${m.user}: ${m.message}\n`;
      zip.addFile('chat-log.txt', chatText);
    }

    // Add a simple readme
    zip.addFile('README.txt',
      'Digital Bridge Offline Pack\n' +
      '==========================\n\n' +
      `Lesson: ${this.getAttribute('lesson-title') || 'Untitled'}\n` +
      `Date: ${new Date().toISOString()}\n\n` +
      'This pack contains:\n' +
      '- transcript-en.txt (English transcript)\n' +
      '- transcript-am.txt (Amharic transcript)\n' +
      '- chat-log.txt (session chat replay)\n'
    );

    const blob = zip.toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offline-pack.zip';
    a.click();
    URL.revokeObjectURL(url);

    dlProgress.textContent = 'Offline pack ready!';
    this._announceToSR('Offline pack downloaded');

    // Clear progress message after 5s
    setTimeout(() => { dlProgress.textContent = ''; }, 5000);
  }

  /* ================================================================
     SCREEN READER ANNOUNCEMENTS
     ================================================================ */

  /**
   * Announce a message to screen readers via live region.
   * @param {string} msg - Text to announce.
   * @param {boolean} [assertive=false] - Use assertive instead of polite.
   */
  _announceToSR(msg, assertive = false) {
    const el = assertive ? this._els.srAlert : this._els.srAnnounce;
    // Force re-announcement by clearing then setting
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = msg; });
  }

  /* ================================================================
     UTILITY
     ================================================================ */

  /** Escape HTML special characters. */
  _escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

/* ================================================================
   5. REGISTER ELEMENT
   ================================================================ */

if (!customElements.get('digital-bridge-player')) {
  customElements.define('digital-bridge-player', DigitalBridgePlayer);
}
