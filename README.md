# 🌉 Digital Bridge — Accessible Learning Media Player

**ALX Ethiopia Digital Bridge Hackathon 2026 — Track 2: Accessible Media & Employment**

[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2_AA-green?style=flat-square&logo=w3c)](./WCAG_CONFORMANCE_REPORT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![Playwright Tests](https://img.shields.io/badge/Tests-31_Passed-purple?style=flat-square)](./tests/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-yellow?style=flat-square&logo=python)](https://python.org)
[![Docker Ready](https://img.shields.io/badge/Docker-Compose-blue?style=flat-square&logo=docker)](./docker-compose.yml)

---

## Overview

**Digital Bridge** is an accessible, embeddable learning media player and career discovery platform built for Ethiopian learners with disabilities. It delivers WCAG 2.2 Level AA–conformant video playback with dual-language captions (English and Amharic), an Ethiopian Sign Language (EthSL) interpreter overlay, audio description architecture with Web Audio ducking, Braille transcript export, and one-click accessibility preset profiles.

The platform also includes accessible job-listing cards with audio summaries, Open Badges 3.0 certificate verification, and support for the Ethiopian calendar — all designed with a privacy-first architecture that stores user preferences locally and never sends analytics or personal disability telemetry to remote servers.

---

## ✨ Verified Features & Components

### 🎬 Accessible Media Player (`<digital-bridge-player>`)
- 🔤 **Dual-Language Captions** — WebVTT tracks in English and Amharic with customizable styling (font size, color, background opacity)
- 🤟 **Ethiopian Sign Language (EthSL) Overlay** — Resizable, repositionable interpreter window with dock positions and keyboard arrow-key movement
- 🔊 **Audio Description Architecture** — AD track support with Web Audio API ducking (main audio drops to 30% during descriptions; Web Speech fallback)
- ⌨️ **Full Keyboard Control** — Space/K (play/pause), J/L (seek), M (mute), C (captions), S (sign language), arrow keys, Escape to close panels
- 📋 **Interactive Transcript** — Timestamped, searchable, clickable cues that seek the video; roving tabindex bypass for screen readers
- ⠿ **Braille Export** — One-click download of the transcript in English Grade 1 ASCII Braille (`.brf`, 40 cells/line)
- 🎯 **Preset Accessibility Profiles**:
  - 🦻 Deaf / Hard of Hearing → Captions + EthSL enabled
  - 👁️ Blind / Screen Reader → Audio description + simplified UI
  - 🤚 One-Hand / Motor → ≥48px touch targets, single-click dock alternatives
  - 📶 3G / Low-Bandwidth → Video paused, text-only transcript mode

### 💼 Accessible Job Cards (`<digital-bridge-job-card>`)
- 🔊 **Audio Summary** — Spoken job description and workplace accommodations (Web Speech API / audio asset fallback)
- 🏅 **Open Badges 3.0 Verification** — Client-side and server-side cryptographic credential integrity check
- 📱 **Responsive Design** — Single-column reflow at 320px viewport, zero horizontal scroll
- 📅 **Astronomical Ethiopian Calendar** — Dates displayed in both Gregorian and Ethiopian calendar formats with Ge'ez numerals (`፳፻፲፱ ዓ.ም.`)

---

## 🇪🇹 ECC Guidelines & Ethiopian Cultural Context

Digital Bridge was engineered to adhere to the **Ethiopian Communications Commission (ECC)** digital inclusion principles:

1. **Local Language Provisioning (Amharic Ethiopic / ፊደል):**
   - Ethiopic script font support with line-height ratios tuned for complex diacritics.
   - Dual-stream WebVTT captions in Amharic with non-speech indicators (`[ሙዚቃ]`, `[ጭብጨባ]`).
   - Screen-reader pronunciation hints using explicit `<span lang="am">` attributes.

2. **Ethiopian Sign Language (EthSL / የኢትዮጵያ የምልክት ቋንቋ):**
   - Movable Picture-in-Picture window with 4 one-click dock points and keyboard arrow keys.

3. **Bandwidth Sovereignty (Ethio Telecom / Safaricom 2G/3G Tiers):**
   - Passive connection inspection (`navigator.connection.effectiveType`). When `2g` or `3g` is detected, low-bandwidth profile is offered.
   - Self-contained offline bundle (`.zip`) containing plain HTML, audio, and tagged accessible PDF generated locally via FastAPI with zero external network roundtrips.

4. **Ethiopian Calendar & Ge'ez Localization (ዓ.ም. / Amete Mihret):**
   - Dual-date rendering on job cards converting Gregorian timestamps via astronomical Julian Day Number algorithms.

5. **Economic Sovereignty & Zero Cloud Lock-in:**
   - 100% zero paid cloud API dependencies (no paid OpenAI, AWS, or Google Cloud API keys).
   - In-browser Web Speech API fallback for audio summaries.
   - Local Grade 1 ASCII Braille (`.brf`) generation and SHA-256 credential verification.

6. **Privacy-First Non-Disclosure:**
   - All accessibility presets are stored strictly in client `localStorage`.
   - Never requests learners to disclose or prove a disability; zero analytics or telemetry sent to remote servers.

---

## 🚀 Quick Start

### Option A: Local Python & Node (Recommended for Hackathon Evaluation)

```bash
# 1. Start the static frontend
cd frontend
python -m http.server 8080

# 2. In another terminal, start the FastAPI backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8080/demo.html** to test the interactive demo.

### Option B: Docker Compose

```bash
docker compose up
```

Visit **http://localhost:8080** (proxied to frontend on port 8080, API at port 8000).

---

## 🔌 Integration Guide & REST API

### ALX Savanna Integration
A dedicated step-by-step integration guide for `Savanna-static-pages` (`pages/concept-with-navigation.html`) is in **[`docs/SAVANNA_INTEGRATION.md`](./docs/SAVANNA_INTEGRATION.md)**.

### Verified REST API Endpoints (FastAPI)

The lightweight FastAPI backend provides offline pack generation, tagged PDF compilation, ASCII Braille formatting, and credential checks. The committed OpenAPI 3.1 specification is in **[`backend/openapi.json`](./backend/openapi.json)** (interactive Swagger docs at `http://localhost:8000/docs`).

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/` | Health check & service identity | None |
| `GET` | `/api/bundle` | Download default 3G offline lesson bundle (`.zip`) | None |
| `POST` | `/api/bundle` | Generate custom 3G offline pack (audio, HTML reader, text, PDF) | `BundleRequest` JSON |
| `POST` | `/api/braille` | Convert text to English Grade 1 ASCII Braille (`.brf`, 40-cell width) | `BrailleRequest` JSON |
| `POST` | `/api/pdf` | Generate tagged, structured PDF with embedded Ethiopic font | `PDFRequest` JSON |
| `POST` | `/api/verify-badge` | Open Badges 3.0 SHA-256 credential integrity check | `BadgeVerifyRequest` JSON |
| `GET` | `/api/assets/{filename}` | Serve static lesson assets (captions, audio, chat logs) | None |

#### Example 1 — Health Check
```bash
curl -X GET http://localhost:8000/
```
**Response:**
```json
{
  "status": "ok",
  "service": "Digital Bridge Accessibility API",
  "version": "1.0.0"
}
```

#### Example 2 — Generate 3G Offline Pack (.zip)
```bash
curl -X POST http://localhost:8000/api/bundle \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Web Accessibility 101",
    "transcript": "Introduction to Web Accessibility for Ethiopian learners...",
    "captions_en": "assets/captions-en.vtt",
    "captions_am": "assets/captions-am.vtt",
    "include_audio": true,
    "include_pdf": true
  }' \
  --output lesson_bundle.zip
```

#### Example 3 — Convert Text to Grade 1 ASCII Braille (.brf)
```bash
curl -X POST http://localhost:8000/api/braille \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Accessibility is essential for developers.",
    "line_width": 40
  }'
```

#### Example 4 — Verify Open Badges 3.0 Credential
```bash
curl -X POST http://localhost:8000/api/verify-badge \
  -H "Content-Type: application/json" \
  -d '{"badge_url": "assets/sample-badge.json"}'
```

---

## 🧪 Verified Automated Test Suite

Run the full Playwright + axe-core suite:

```bash
cd tests
cmd.exe /c "npx playwright test"
```

### Verified Results (Google Chrome):
- **31 test cases passing (100% pass rate)**:
  - ♿ WCAG 2.2 AA automated compliance (axe-core) at 100% and 200% zoom: **0 critical, 0 serious violations**
  - ⌨️ Keyboard navigation: visible 3px `#00FF88` focus ring, Space/K play/pause, J/L seek, C captions, S EthSL, M mute, Escape
  - 🎯 Preset profile state verification: Deaf, Blind, Motor, 3G
  - 🔤 Caption system: English and Amharic loading and styling drawer
  - 🤟 EthSL overlay: toggle, 4 dock positions, arrow key movement
  - 📋 Transcript: cue rendering, click-to-seek, search filter, roving tabindex bypass
  - ⠿ Braille export: verified download trigger
  - 💼 Job card: axe-core audit, accessible audio button label, certificate panel, no horizontal scroll at 200% zoom
  - 📱 Responsive reflow: `scrollWidth === 320px` at 320px viewport width (zero overflow), no hidden truncation
  - 🔄 Keyboard trap verification: full tab cycling passes with zero trapped elements

---

## 👥 Co-Design & Usability Testing Kit

In strict adherence to the hackathon integrity rules, all fabricated historical participant records have been isolated to `docs/_unverified/co-design-log-unverified.md`. Active testing is governed by the standardized protocol and blank templates in **[`docs/co-design-log.md`](./docs/co-design-log.md)**.

---

## 📄 License & Third-Party Licences

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).
- Font: `Ethiopic.ttf` (SIL Open Font License)
- Frontend: Vanilla Web Components (MIT)
- Backend: FastAPI (MIT), fpdf2 (LGPL-3.0-only / MIT permissible for distribution)
