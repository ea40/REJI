# ALX Savanna Static Pages — Integration Guide

This guide details how to integrate the **Digital Bridge Accessible Media Player** (`<digital-bridge-player>`) and **Career Gateway Card** (`<digital-bridge-job-card>`) into the ALX Savanna static pages repository ([github.com/alx-africa/Savanna-static-pages](https://github.com/alx-africa/Savanna-static-pages)).

---

## 1. Architecture Overview

Both components are built as **zero-dependency W3C Standard Custom Elements (Web Components)** using **Shadow DOM v1**:
- **Zero Style Collisions:** Savanna's Bootstrap, Tailwind, or global reset stylesheets can never bleed into the player controls or break focus rings.
- **Zero Build Step:** Works out of the box in plain HTML pages without Vite, Webpack, or npm build steps.
- **Single Script Tag:** Simply include the script at the bottom of the page or in the `<head>` with `defer`.

---

## 2. Integrating `<digital-bridge-player>` into Savanna Course Pages

In Savanna course view templates (e.g., `course-view.html`, `lesson.html`, or `curriculum-module.html`):

### Step A: Include the Component Script
Add the script tag before the closing `</body>` tag:

```html
<script src="/static/js/digital-bridge-player.js"></script>
```

### Step B: Replace or Augment Existing `<video>` Tags
Replace standard HTML5 `<video>` tags with the `<digital-bridge-player>` element:

```html
<div class="savanna-lesson-container">
  <digital-bridge-player
    lesson-title="Module 3: Data Structures & Algorithms"
    src="https://media.alx.et/courses/cs/dsa-lesson3.mp4"
    poster="https://media.alx.et/courses/cs/dsa-poster.jpg"
    captions-en="https://media.alx.et/captions/cs/dsa-en.vtt"
    captions-am="https://media.alx.et/captions/cs/dsa-am.vtt"
    ethsl-src="https://media.alx.et/ethsl/cs/dsa-sign.mp4"
    ad-src="https://media.alx.et/audio/cs/dsa-ad.mp3"
    chat-log="https://media.alx.et/logs/cs/dsa-chat.json"
    preset="standard"
  ></digital-bridge-player>
</div>
```

### Supported Attributes on `<digital-bridge-player>`:
| Attribute | Description | Default |
|---|---|---|
| `lesson-title` | Title announced to screen readers and displayed in header | `"Accessible Video Player"` |
| `src` | URL to primary video stream (MP4 / WebM / Canvas fallback) | Canvas test stream |
| `captions-en` | URL to English WebVTT track | Local fallback |
| `captions-am` | URL to authentic Amharic Ethiopic WebVTT track | Local fallback |
| `ethsl-src` | URL to Ethiopian Sign Language interpreter video stream | Synthesized stream |
| `ad-src` | URL to secondary spoken Audio Description audio track | Web Speech fallback |
| `chat-log` | URL to timestamped interactive replay chat log JSON | Mock log |
| `preset` | Initial preset profile (`standard`, `deaf`, `blind`, `motor`, `lowbw`) | `"standard"` |

---

## 3. Integrating `<digital-bridge-job-card>` into Savanna Career Portals

In Savanna career gateway pages, alumni hubs, or hiring partner dashboards (e.g., `career-portal.html`, `job-board.html`):

### Step A: Include the Job Card Script
```html
<script src="/static/js/digital-bridge-job-card.js"></script>
```

### Step B: Render Inclusive Job Cards
```html
<div class="savanna-job-grid">
  <digital-bridge-job-card
    job-title="Junior Accessibility QA Engineer"
    employer="Chapa Financial Technologies"
    location="Bole Medhanialem, Addis Ababa"
    salary="45,000 – 65,000 ETB / month"
    deadline="2027-03-31"
    accommodations="Screen reader audited workstations, Flexible hybrid schedule, Assistive keyboards provided"
    badge-url="/assets/sample-badge.json"
    description="Help audit and maintain digital financial products ensuring full compliance with Ethiopian Communications Authority (ECA) accessibility principles and WCAG 2.2 AA standards."
  ></digital-bridge-job-card>
</div>
```

### Key Features Automatically Rendered:
1. **Schema.org/JobPosting JSON-LD:** Embedded automatically in the page for Google Search indexing and assistive technology parsers.
2. **Astronomical Dual-Calendar Display:** Computes accurate Gregorian and Ethiopian calendar dates with Geez digits (e.g. `November 14, 2026 (Hidar 5, 2019 EC · ኅዳር ፭ ቀን ፳፻፲፱ ዓ.ም.)`).
3. **Audio Summary Button:** 1-click spoken audio summary of job requirements and workplace accommodations via browser Web Speech API.
4. **SHA-256 Credential Integrity Check:** Verifies Open Badges 3.0 course credentials directly in the browser or via backend API.

---

## 4. Responsive & Low-Bandwidth Compatibility

- **Reflow at 320px Viewport:** Tested with zero horizontal scrollbars on low-cost Android mobile devices common in Ethiopia (e.g. Tecno, Infinix, itel).
- **200% Browser Zoom:** All cards and player controls stack without clipping or overlapping.
- **Offline 3G Pack:** Works on rural Ethio Telecom / Safaricom networks by falling back to compressed audio, transcripts, and tagged PDFs.
