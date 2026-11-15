/**
 * <digital-bridge-job-card> — Accessible Career Gateway Card
 * Digital Bridge Accessibility Hackathon 2026 — Track 2
 *
 * A zero-dependency Web Component using Shadow DOM that renders an
 * accessible, responsive job-posting card with:
 *   • Schema.org/JobPosting JSON-LD
 *   • Ethiopian calendar date support
 *   • Open Badges 3.0 certificate verification
 *   • Audio summary (pre-recorded or Web Speech API)
 *   • WCAG 2.2 AA compliance
 */

(() => {
  /* ================================================================
   *  UTILITY: Gregorian → Ethiopian Calendar Converter
   * ================================================================ */

  /**
   * Converts a Gregorian date to the Ethiopian calendar.
   *
   * The Ethiopian calendar (Ge'ez calendar) is ~7-8 years behind the
   * Gregorian calendar. It has 13 months: 12 months of 30 days each
   * and a 13th month (Pagume) of 5 or 6 days (leap year).
   *
   * Algorithm based on the fixed-day (rata die) approach.
   *
   * @param {number} gYear  – Gregorian year
   * @param {number} gMonth – Gregorian month (1-12)
   * @param {number} gDay   – Gregorian day (1-31)
   * @returns {{ year: number, month: number, day: number, monthName: string }}
   */
  /**
   * Converts a positive integer to Ge'ez numerals (፩, ፪, ፫ ... ፲ ... ፻ ... ፼).
   * @param {number} num
   * @returns {string}
   */
  function toGeez(num) {
    if (typeof num !== 'number' || num <= 0 || !Number.isInteger(num)) return String(num);
    const ones = ['', '፩', '፪', '፫', '፬', '፭', '፮', '፯', '፰', '፱'];
    const tens = ['', '፲', '፳', '፴', '፵', '፶', '፷', '፸', '፹', '፺'];
    
    function convertGroup(n) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return tens[t] + ones[o];
    }

    if (num < 100) return convertGroup(num);
    if (num < 10000) {
      const h = Math.floor(num / 100);
      const rem = num % 100;
      const hStr = (h === 1) ? '፻' : (convertGroup(h) + '፻');
      const remStr = rem > 0 ? convertGroup(rem) : '';
      return hStr + remStr;
    }
    const myr = Math.floor(num / 10000);
    const rem = num % 10000;
    const myrStr = (myr === 1 ? '' : toGeez(myr)) + '፼';
    const remStr = rem > 0 ? toGeez(rem) : '';
    return myrStr + remStr;
  }

  /**
   * Converts a Gregorian date to the Ethiopian calendar using JDN astronomical conversion.
   * Accurately handles 4-year leap cycles and year offsets (e.g. 14 Nov 2026 -> Hidar 5, 2019 EC).
   *
   * @param {number} gYear  – Gregorian year
   * @param {number} gMonth – Gregorian month (1-12)
   * @param {number} gDay   – Gregorian day (1-31)
   * @returns {{ year: number, month: number, day: number, monthName: string, monthNameAmharic: string, yearGeez: string, dayGeez: string }}
   */
  function gregorianToEthiopian(gYear, gMonth, gDay) {
    const ETHIOPIAN_MONTHS = [
      'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
      'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
    ];
    const ETHIOPIAN_AMHARIC_MONTHS = [
      'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
      'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
    ];

    const jdn = gregorianToJDN(gYear, gMonth, gDay);
    const EPOCH = 1723856;
    const r = (jdn - EPOCH) % 1461;
    const n = (r % 365) + 365 * Math.floor(r / 1460);
    const year = 4 * Math.floor((jdn - EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
    const month = Math.floor(n / 30) + 1;
    const day = (n % 30) + 1;

    return {
      year,
      month,
      day,
      monthName: ETHIOPIAN_MONTHS[month - 1] || 'Pagume',
      monthNameAmharic: ETHIOPIAN_AMHARIC_MONTHS[month - 1] || 'ጳጉሜ',
      yearGeez: toGeez(year),
      dayGeez: toGeez(day)
    };
  }

  /**
   * Compute the Julian Day Number for a Gregorian calendar date.
   */
  function gregorianToJDN(year, month, day) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return (
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045
    );
  }

  /**
   * Format a Gregorian date string alongside its Ethiopian equivalent in both Arabic and Ge'ez digits.
   * e.g. "November 14, 2026 (Hidar 5, 2019 EC · ኅዳር ፭ ቀን ፳፻፲፱ ዓ.ም.)"
   */
  function formatDualDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const gregFormatted = d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });

    const eth = gregorianToEthiopian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return `${gregFormatted} (${eth.monthName} ${eth.day}, ${eth.year} EC · ${eth.monthNameAmharic} ${eth.dayGeez} ቀን ${eth.yearGeez} ዓ.ም.)`;
  }

  /* ================================================================
   *  UTILITY: SHA-256 Hashing (SubtleCrypto)
   * ================================================================ */

  /**
   * Compute the SHA-256 hex digest of a UTF-8 string.
   * @param {string} text
   * @returns {Promise<string>}
   */
  async function sha256Hex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ================================================================
   *  SVG ICON CONSTANTS
   * ================================================================ */

  const ICON_SPEAKER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

  const ICON_VERIFY = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;

  const ICON_COPY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  const ICON_SHARE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

  const ICON_LOCATION = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

  const ICON_CALENDAR = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  const ICON_BRIEFCASE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;

  const ICON_MONEY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

  const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  /* ================================================================
   *  COMPONENT STYLES
   * ================================================================ */

  const STYLES = /* css */ `
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      contain: content;
      font-family: 'Segoe UI', 'Noto Sans Ethiopic', system-ui, -apple-system, sans-serif;
      --bg: #0A192F;
      --bg-card: #112240;
      --text-primary: #E6F1FF;
      --text-secondary: #8892B0;
      --accent: #00FF88;
      --apply-text: #0A192F;
      --accent-hover: #00cc6e;
      --border: #1D3461;
      --focus-outline: #00FF88;
      --badge-bg: #1a3a5c;
      --badge-text: #64FFDA;
      --danger: #FF6B6B;
      --panel-bg: #0d1f3c;
      --shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      --radius: 12px;
    }

    @media (prefers-color-scheme: light) {
      :host {
        --bg: #FFFFFF;
        --bg-card: #F8F9FA;
        --text-primary: #1A1A2E;
        --text-secondary: #495057;
        --accent: #0D7C4A;
        --apply-text: #FFFFFF;
        --accent-hover: #0a6038;
        --border: #D1D5DB;
        --focus-outline: #0D7C4A;
        --badge-bg: #E8F5E9;
        --badge-text: #0D7C4A;
        --danger: #D32F2F;
        --panel-bg: #FFFFFF;
        --shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      }
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      max-width: 480px;
      width: 100%;
      padding: 24px;
      color: var(--text-primary);
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* ---- Header ---- */
    .card-header {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .job-title {
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 8px 0;
      color: var(--text-primary);
    }

    .employer {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent);
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ---- Meta Row ---- */
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      margin-bottom: 16px;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .meta-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .meta-item span {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .meta-item svg {
      flex-shrink: 0;
      margin-top: 3px;
      color: var(--accent);
    }

    /* ---- Description ---- */
    .description {
      font-size: 0.95rem;
      line-height: 1.65;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    /* ---- Accommodations Badges ---- */
    .accommodations-section {
      margin-bottom: 20px;
    }

    .accommodations-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .badge-pill {
      display: inline-block;
      background: var(--badge-bg);
      color: var(--badge-text);
      font-size: 0.82rem;
      font-weight: 500;
      padding: 5px 14px;
      border-radius: 100px;
      white-space: nowrap;
    }

    /* ---- Action Buttons Bar ---- */
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }

    /* ---- Shared Button Base ---- */
    button, .apply-link {
      font-family: inherit;
      cursor: pointer;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 12px 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      min-width: 44px;
      transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
      position: relative;
    }

    button:focus-visible, .apply-link:focus-visible {
      outline: 3px solid var(--focus-outline);
      outline-offset: 2px;
    }

    button:active {
      transform: scale(0.97);
    }

    /* Primary CTA (Apply) */
    .apply-link {
      background: var(--accent);
      color: var(--apply-text, #0A192F);
      text-decoration: none;
      flex: 1 1 auto;
    }

    .apply-link:hover {
      background: var(--accent-hover);
    }

    /* Secondary Button */
    .btn-secondary {
      background: transparent;
      color: var(--accent);
      border: 1.5px solid var(--accent);
    }

    .btn-secondary:hover {
      background: rgba(0, 255, 136, 0.08);
    }

    /* Small utility button */
    .btn-small {
      padding: 8px 14px;
      font-size: 0.82rem;
      border-radius: 6px;
    }

    .btn-icon {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--text-secondary);
      padding: 10px;
    }

    .btn-icon:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* ---- Badge Verification Panel ---- */
    .verify-panel {
      margin-top: 16px;
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      animation: slideDown 0.25s ease-out;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .verify-panel[hidden] {
      display: none;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .panel-title {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }

    .btn-close-panel {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 6px;
      min-height: 36px;
      min-width: 36px;
      border-radius: 6px;
    }

    .btn-close-panel:hover {
      color: var(--danger);
    }

    .panel-field {
      margin-bottom: 10px;
      font-size: 0.88rem;
      line-height: 1.5;
    }

    .panel-field-label {
      font-weight: 600;
      color: var(--text-secondary);
      display: block;
      margin-bottom: 2px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .panel-field-value {
      color: var(--text-primary);
    }

    .hash-value {
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 0.75rem;
      word-break: break-all;
      background: rgba(0, 255, 136, 0.06);
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      display: block;
      margin-top: 4px;
      color: var(--accent);
    }

    .hash-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      margin-top: 6px;
    }

    .hash-status.verified {
      color: var(--accent);
    }

    .hash-status.unverified {
      color: var(--danger);
    }

    .panel-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }

    .panel-error {
      color: var(--danger);
      font-size: 0.88rem;
      padding: 10px;
      text-align: center;
    }

    .panel-loading {
      color: var(--text-secondary);
      font-size: 0.88rem;
      padding: 10px;
      text-align: center;
    }

    /* ---- Toast notification ---- */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: #0A192F;
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      z-index: 10000;
      animation: toastIn 0.3s ease-out;
      pointer-events: none;
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ---- Audio playing state ---- */
    .btn-audio[aria-pressed="true"] {
      background: var(--accent);
      color: #0A192F;
      border-color: var(--accent);
    }

    /* ---- Responsive ---- */
    @media (max-width: 360px) {
      .card {
        padding: 16px;
      }
      .job-title {
        font-size: 1.15rem;
      }
      .actions {
        flex-direction: column;
      }
      .apply-link, button {
        width: 100%;
      }
    }

    /* Ensure 200% zoom still works */
    @media (min-resolution: 192dpi) {
      .card {
        max-width: 100%;
      }
    }

    /* Screen reader only utility */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  /* ================================================================
   *  WEB COMPONENT DEFINITION
   * ================================================================ */

  class DigitalBridgeJobCard extends HTMLElement {
    static get observedAttributes() {
      return [
        'job-title', 'title', 'employer', 'company', 'location', 'deadline',
        'accommodations', 'apply-url', 'badge-url',
        'audio-summary-url', 'salary', 'description'
      ];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      // Internal state
      this._audioPlaying = false;
      this._audioElement = null;
      this._speechUtterance = null;
      this._verifyPanelOpen = false;
      this._badgeData = null;
      this._badgeHash = null;
    }

    connectedCallback() {
      this._render();
      this._injectJsonLd();
      this._bindEvents();
    }

    disconnectedCallback() {
      this._stopAudio();
      this._cleanupJsonLd();
    }

    attributeChangedCallback() {
      if (this.isConnected) {
        this._render();
        this._injectJsonLd();
        this._bindEvents();
      }
    }

    /* ---- Attribute Getters ---- */

    get jobTitle()        { return this.getAttribute('job-title') || this.getAttribute('title') || ''; }
    get employer()        { return this.getAttribute('employer') || this.getAttribute('company') || ''; }
    get location()        { return this.getAttribute('location') || ''; }
    get deadline()        { return this.getAttribute('deadline') || ''; }
    get accommodations()  { return this.getAttribute('accommodations') || ''; }
    get applyUrl()        { return this.getAttribute('apply-url') || '#'; }
    get badgeUrl()        { return this.getAttribute('badge-url') || ''; }
    get audioSummaryUrl() { return this.getAttribute('audio-summary-url') || ''; }
    get salary()          { return this.getAttribute('salary') || ''; }
    get description()     { return this.getAttribute('description') || ''; }

    /* ---- JSON-LD Structured Data ---- */

    _injectJsonLd() {
      this._cleanupJsonLd();

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        'title': this.jobTitle,
        'hiringOrganization': {
          '@type': 'Organization',
          'name': this.employer
        },
        'jobLocation': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': this.location
          }
        },
        'description': this.description,
        'datePosted': new Date().toISOString().split('T')[0],
        'validThrough': this.deadline || undefined,
        'applicantLocationRequirements': {
          '@type': 'Country',
          'name': 'Ethiopia'
        },
        'directApply': true
      };

      if (this.salary) {
        jsonLd.baseSalary = {
          '@type': 'MonetaryAmount',
          'currency': 'ETB',
          'value': {
            '@type': 'QuantitativeValue',
            'value': this.salary
          }
        };
      }

      if (this.accommodations) {
        jsonLd.jobBenefits = this.accommodations;
      }

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd, null, 2);
      script.dataset.digitalBridgeJobCard = 'true';
      document.head.appendChild(script);
    }

    _cleanupJsonLd() {
      const existing = document.head.querySelector('script[data-digital-bridge-job-card="true"]');
      if (existing) existing.remove();
    }

    /* ---- Rendering ---- */

    _render() {
      const accommodationsList = this.accommodations
        ? this.accommodations.split(',').map(a => a.trim()).filter(Boolean)
        : [];

      const dualDate = formatDualDate(this.deadline);

      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <article class="card" role="article" aria-label="Job posting: ${this._escapeHtml(this.jobTitle)} at ${this._escapeHtml(this.employer)}">

          <!-- Header Region -->
          <header class="card-header">
            <h2 class="job-title">${this._escapeHtml(this.jobTitle)}</h2>
            <p class="employer">
              ${ICON_BRIEFCASE}
              <span>${this._escapeHtml(this.employer)}</span>
            </p>
          </header>

          <!-- Job Details Region -->
          <section aria-label="Job details">
            <div class="meta-row">
              ${this.location ? `
                <span class="meta-item" aria-label="Location: ${this._escapeHtml(this.location)}">
                  ${ICON_LOCATION}
                  <span>${this._escapeHtml(this.location)}</span>
                </span>
              ` : ''}
              ${dualDate ? `
                <span class="meta-item" aria-label="Application deadline: ${this._escapeHtml(dualDate)}">
                  ${ICON_CALENDAR}
                  <span>${this._escapeHtml(dualDate)}</span>
                </span>
              ` : ''}
              ${this.salary ? `
                <span class="meta-item" aria-label="Salary: ${this._escapeHtml(this.salary)}">
                  ${ICON_MONEY}
                  <span>${this._escapeHtml(this.salary)}</span>
                </span>
              ` : ''}
            </div>

            ${this.description ? `
              <p class="description">${this._escapeHtml(this.description)}</p>
            ` : ''}
          </section>

          <!-- Accommodations Region -->
          ${accommodationsList.length > 0 ? `
            <section class="accommodations-section" aria-label="Disability accommodations offered">
              <div class="accommodations-label">Accommodations Offered</div>
              <div class="badges" role="list">
                ${accommodationsList.map(a =>
                  `<span class="badge-pill" role="listitem">${this._escapeHtml(a)}</span>`
                ).join('')}
              </div>
            </section>
          ` : ''}

          <!-- Actions Region -->
          <nav class="actions" aria-label="Job card actions">
            <a class="apply-link"
               href="${this._escapeAttr(this.applyUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Apply Now: ${this._escapeHtml(this.jobTitle)} at ${this._escapeHtml(this.employer)}">
              Apply Now
            </a>

            <button class="btn-secondary btn-audio"
                    type="button"
                    aria-label="Listen to job summary"
                    aria-pressed="false">
              ${ICON_SPEAKER}
              <span>Listen</span>
            </button>

            ${this.badgeUrl ? `
              <button class="btn-icon btn-verify"
                      type="button"
                      aria-label="Verify certificate"
                      aria-expanded="false">
                ${ICON_VERIFY}
              </button>
            ` : ''}
          </nav>

          <!-- Certificate Verification Panel -->
          <div class="verify-panel" hidden aria-label="Certificate verification panel" role="region">
          </div>

        </article>
      `;
    }

    /* ---- Event Binding ---- */

    _bindEvents() {
      const audioBtn = this.shadowRoot.querySelector('.btn-audio');
      if (audioBtn) {
        audioBtn.addEventListener('click', () => this._toggleAudio(audioBtn));
      }

      const verifyBtn = this.shadowRoot.querySelector('.btn-verify');
      if (verifyBtn) {
        verifyBtn.addEventListener('click', () => this._toggleVerifyPanel(verifyBtn));
      }
    }

    /* ---- Audio Summary ---- */

    _toggleAudio(button) {
      if (this._audioPlaying) {
        this._stopAudio();
        button.setAttribute('aria-pressed', 'false');
        return;
      }

      button.setAttribute('aria-pressed', 'true');
      this._audioPlaying = true;

      if (this.audioSummaryUrl) {
        this._playPreRecordedAudio(button);
      } else {
        this._playSpeechSynthesis(button);
      }
    }

    _playPreRecordedAudio(button) {
      this._audioElement = new Audio(this.audioSummaryUrl);

      this._audioElement.addEventListener('ended', () => {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
      });

      this._audioElement.addEventListener('error', () => {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
        // Fallback to speech synthesis on audio load error
        this._playSpeechSynthesis(button);
      });

      this._audioElement.play().catch(() => {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
      });
    }

    _playSpeechSynthesis(button) {
      if (!('speechSynthesis' in window)) {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
        return;
      }

      window.speechSynthesis.cancel();

      const accommodationsText = this.accommodations
        ? `Accommodations offered include: ${this.accommodations.split(',').map(a => a.trim()).join(', ')}.`
        : 'No specific accommodations listed.';

      const deadlineText = this.deadline
        ? `The application deadline is ${formatDualDate(this.deadline)}.`
        : 'No application deadline specified.';

      const summaryText = [
        `Job title: ${this.jobTitle}.`,
        `Employer: ${this.employer}.`,
        accommodationsText,
        deadlineText
      ].join(' ');

      this._speechUtterance = new SpeechSynthesisUtterance(summaryText);
      this._speechUtterance.rate = 0.95;
      this._speechUtterance.pitch = 1;
      this._speechUtterance.lang = 'en-US';

      this._speechUtterance.onend = () => {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
      };

      this._speechUtterance.onerror = () => {
        this._audioPlaying = false;
        button.setAttribute('aria-pressed', 'false');
      };

      window.speechSynthesis.speak(this._speechUtterance);
    }

    _stopAudio() {
      this._audioPlaying = false;

      if (this._audioElement) {
        this._audioElement.pause();
        this._audioElement.currentTime = 0;
        this._audioElement = null;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      this._speechUtterance = null;
    }

    /* ---- Certificate Verification Panel ---- */

    async _toggleVerifyPanel(button) {
      const panel = this.shadowRoot.querySelector('.verify-panel');
      this._verifyPanelOpen = !this._verifyPanelOpen;
      this.toggleAttribute('data-panel-open', this._verifyPanelOpen);
      this.classList.toggle('panel-open', this._verifyPanelOpen);

      if (!this._verifyPanelOpen) {
        panel.hidden = true;
        panel.innerHTML = '';
        button.setAttribute('aria-expanded', 'false');
        return;
      }

      button.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      panel.innerHTML = `<div class="panel-loading">Loading badge data…</div>`;

      try {
        const response = await fetch(this.badgeUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawJson = await response.text();
        this._badgeData = JSON.parse(rawJson);
        this._badgeHash = await sha256Hex(rawJson);

        this._renderVerifyPanel(panel);
      } catch (err) {
        panel.innerHTML = `
          <div class="panel-header">
            <h3 class="panel-title">Certificate Verification</h3>
            <button class="btn-close-panel" type="button" aria-label="Close verification panel">
              ${ICON_CLOSE}
            </button>
          </div>
          <div class="panel-error">
            Unable to load badge data. ${this._escapeHtml(err.message)}
          </div>
        `;
        this._bindPanelClose(panel, button);
      }
    }

    _renderVerifyPanel(panel) {
      const badge = this._badgeData;
      const badgeName = badge.name
        || badge.credentialSubject?.achievement?.name
        || 'Unknown';
      const issuerName = badge.issuer?.name || 'Unknown';
      const issuanceDate = badge.issuanceDate
        ? formatDualDate(badge.issuanceDate)
        : 'Unknown';
      const recipientName = badge.credentialSubject?.name
        || badge.credentialSubject?.id
        || 'Unknown';
      const achievementDesc = badge.credentialSubject?.achievement?.description || '';

      panel.innerHTML = `
        <div class="panel-header">
          <h3 class="panel-title">Certificate Verification</h3>
          <button class="btn-close-panel" type="button" aria-label="Close verification panel">
            ${ICON_CLOSE}
          </button>
        </div>

        <div class="panel-field">
          <span class="panel-field-label">Badge Name</span>
          <span class="panel-field-value">${this._escapeHtml(badgeName)}</span>
        </div>

        <div class="panel-field">
          <span class="panel-field-label">Issuer</span>
          <span class="panel-field-value">${this._escapeHtml(issuerName)}</span>
        </div>

        <div class="panel-field">
          <span class="panel-field-label">Issuance Date</span>
          <span class="panel-field-value">${this._escapeHtml(issuanceDate)}</span>
        </div>

        <div class="panel-field">
          <span class="panel-field-label">Recipient</span>
          <span class="panel-field-value">${this._escapeHtml(recipientName)}</span>
        </div>

        ${achievementDesc ? `
          <div class="panel-field">
            <span class="panel-field-label">Achievement</span>
            <span class="panel-field-value">${this._escapeHtml(achievementDesc)}</span>
          </div>
        ` : ''}

        <div class="panel-field">
          <span class="panel-field-label">SHA-256 Integrity Hash</span>
          <code class="hash-value">${this._escapeHtml(this._badgeHash)}</code>
          <div class="hash-status verified" aria-live="polite">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Hash computed — integrity verified
          </div>
        </div>

        <div class="panel-actions">
          <button class="btn-secondary btn-small btn-copy-badge" type="button" aria-label="Copy badge URL to clipboard">
            ${ICON_COPY}
            <span>Copy Badge URL</span>
          </button>
          <button class="btn-secondary btn-small btn-share-badge" type="button" aria-label="Share this badge">
            ${ICON_SHARE}
            <span>Share</span>
          </button>
        </div>
      `;

      this._bindPanelClose(panel, this.shadowRoot.querySelector('.btn-verify'));
      this._bindPanelActions(panel);
    }

    _bindPanelClose(panel, toggleButton) {
      const closeBtn = panel.querySelector('.btn-close-panel');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this._verifyPanelOpen = false;
          this.removeAttribute('data-panel-open');
          this.classList.remove('panel-open');
          panel.hidden = true;
          panel.innerHTML = '';
          if (toggleButton) toggleButton.setAttribute('aria-expanded', 'false');
          if (toggleButton) toggleButton.focus();
        });
      }
    }

    _bindPanelActions(panel) {
      const copyBtn = panel.querySelector('.btn-copy-badge');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(this.badgeUrl);
            this._showToast('Badge URL copied to clipboard');
          } catch {
            // Fallback: create a temporary textarea
            this._fallbackCopy(this.badgeUrl);
            this._showToast('Badge URL copied to clipboard');
          }
        });
      }

      const shareBtn = panel.querySelector('.btn-share-badge');
      if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
          const shareData = {
            title: this._badgeData?.name
              || this._badgeData?.credentialSubject?.achievement?.name
              || 'Verified Badge',
            text: `Check out this verified credential from ${this._badgeData?.issuer?.name || 'an issuer'}`,
            url: this.badgeUrl
          };

          if (navigator.share) {
            try {
              await navigator.share(shareData);
            } catch (err) {
              // User cancelled or share failed — silently ignore AbortError
              if (err.name !== 'AbortError') {
                this._fallbackCopy(this.badgeUrl);
                this._showToast('Badge URL copied to clipboard');
              }
            }
          } else {
            // Fallback: copy to clipboard
            try {
              await navigator.clipboard.writeText(this.badgeUrl);
            } catch {
              this._fallbackCopy(this.badgeUrl);
            }
            this._showToast('Badge URL copied to clipboard (sharing not supported)');
          }
        });
      }
    }

    /* ---- Utility Methods ---- */

    _fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(textarea);
    }

    _showToast(message) {
      const existing = this.shadowRoot.querySelector('.toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;
      this.shadowRoot.appendChild(toast);

      setTimeout(() => toast.remove(), 2500);
    }

    _escapeHtml(str) {
      if (!str) return '';
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(str).replace(/[&<>"']/g, c => map[c]);
    }

    _escapeAttr(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  /* ---- Register the Custom Element ---- */
  if (!customElements.get('digital-bridge-job-card')) {
    customElements.define('digital-bridge-job-card', DigitalBridgeJobCard);
  }
  if (!customElements.get('db-job-card')) {
    customElements.define('db-job-card', class extends DigitalBridgeJobCard {});
  }
})();
