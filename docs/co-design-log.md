# Co-Design & Usability Testing Protocol and Log (Blank Template)

**Digital Bridge Accessibility Hackathon 2026 — Track 2: Accessible Learning Media**  
**Location:** Addis Ababa, Ethiopia  
**Evaluation Standard:** WCAG 2.2 Level AA & Ethiopian Communications Commission (ECC) Accessibility Guidelines  
**Integrity Notice:** Prior unverified draft entries containing unconfirmed participant names and simulated timestamps have been moved to `docs/_unverified/co-design-log-unverified.md`. Under the non-negotiable hackathon integrity rules, all entries in this active log must be recorded exclusively by human facilitators and co-designers during actual evaluation sessions.

---

## 1. Co-Design Evaluation Protocol

### 1.1 Ethics, Privacy, and Consent
- **Non-Disclosure Guarantee:** Co-designers are never asked to disclose medical diagnoses or register personal disability data.
- **Data Minimization:** No biometric, account, or personal telemetry is collected, stored, or transmitted.
- **Voluntary & Compensated:** Participants retain full authority over the session and are compensated unconditionally.

### 1.2 The Main Evaluation Task (Pass/Fail Gate)
Each co-designer is asked to complete the core user journey **unaided**:
1. **Find and Start the Lesson:** Navigate to the player using preferred assistive tech or input modality.
2. **Configure Accessible Media:**
   - Switch captions between English and Amharic (Ethiopic script).
   - Customize caption styling (font size, contrast, background).
   - Toggle and reposition the Ethiopian Sign Language (EthSL) window using keyboard or one-click dock points.
   - For blind/screen-reader users: activate the Audio Description (AD) track and verify audio ducking / spoken descriptions.
3. **Navigate via Interactive Transcript:**
   - Search the transcript for a key concept.
   - Seek video playback by selecting a transcript cue.
   - Bypass transcript using single-tab roving tabindex.
4. **Data Meter & Offline Pack:**
   - Inspect data footprint before download (Video vs. Audio vs. Text).
   - Download the self-contained offline learning pack.
5. **Career Gateway & Job Card:**
   - Navigate to the job listings section.
   - Test at 200% zoom and 320px reflow without horizontal scrolling.
   - Listen to / inspect the job audio summary.
   - Open and verify the cryptographic certificate / Open Badges 3.0 link.

---

## 2. Evaluation Matrix

| Testing Dimension | Tool / Environment | Target Metric | Result Status |
|---|---|---|---|
| **Screen Reader (Desktop)** | NVDA on Firefox / Chrome | All controls announced, transcript navigable, zero traps | `[Pending Human Session]` |
| **Screen Reader (Mobile)** | TalkBack on Android (Tecno / Samsung) | Touch targets ≥48px, swipe order matches visual reading order | `[Pending Human Session]` |
| **Keyboard-Only** | Tab, Shift+Tab, Space, J/K/L/M/C/S/A | 3px visible `#00FF88` focus ring, roving tabindex, modal traps escape | `[Pending Human Session]` |
| **Visual Reflow & Zoom** | 200% Zoom & 320px Viewport | `scrollWidth` = 320px (zero horizontal scroll), text legible, no clipping | `[Pending Human Session]` |
| **Sound-Off Operation** | Audio muted | Visual cues for all non-speech audio events, captions in sync | `[Pending Human Session]` |
| **3G Low-Bandwidth** | Chrome DevTools "Slow 3G" / Ethio Telecom 3G | Offline bundle < 100 KB text, audio-only fallback option functional | `[Pending Human Session]` |

---

## 3. Blank Session Log Templates

### Session Template: Deaf & Hard of Hearing Co-Designer
- **Participant ID / Pseudonym:** `____________________`
- **Date & Time (EAT):** `____________________`
- **Primary Assistive Tech / Modality:** Ethiopian Sign Language (EthSL) / Captions / Sound-off
- **Device / OS / Browser:** `____________________`
- **Unaided Task Completion (Yes / No / Partial):** `________`
- **Time to Complete Main Task:** `________ minutes`

#### Detailed Observations
| Checkpoint | Observation / Participant Reaction | Friction Point / Failure | Required Engineering Fix |
|---|---|---|---|
| Amharic Caption Readability (Ethiopic fidäl diacritics) | | | |
| EthSL PiP Docking & Repositioning | | | |
| Non-speech Sound Indicators (`[ሙዚቃ]`, `[ጭብጨባ]`, etc.) | | | |
| Caption Drawer Styling Persistence | | | |

#### Participant Rating & Direct Feedback
- **Ease of Use (1-5):** `[ ]`
- **Autonomy / Independence (1-5):** `[ ]`
- **Participant's Own Words / Notes:**  
  > *"________________________________________________________________"*
- **Facilitator Signature / Date:** `____________________`

---

### Session Template: Blind & Low-Vision Co-Designer
- **Participant ID / Pseudonym:** `____________________`
- **Date & Time (EAT):** `____________________`
- **Primary Assistive Tech:** NVDA / TalkBack / Keyboard-only
- **Device / OS / Browser:** `____________________`
- **Unaided Task Completion (Yes / No / Partial):** `________`
- **Time to Complete Main Task:** `________ minutes`

#### Detailed Observations
| Checkpoint | Observation / Participant Reaction | Friction Point / Failure | Required Engineering Fix |
|---|---|---|---|
| Screen reader announcements on player controls | | | |
| Roving tabindex on transcript (single tab-stop bypass) | | | |
| Audio description track & ducking perception | | | |
| Job card accessible label & audio summary playback | | | |
| Braille transcript export usability | | | |

#### Participant Rating & Direct Feedback
- **Ease of Use (1-5):** `[ ]`
- **Autonomy / Independence (1-5):** `[ ]`
- **Participant's Own Words / Notes:**  
  > *"________________________________________________________________"*
- **Facilitator Signature / Date:** `____________________`

---

### Session Template: Low-Bandwidth / 3G Mobile Co-Designer
- **Participant ID / Pseudonym:** `____________________`
- **Date & Time (EAT):** `____________________`
- **Primary Device:** Low-cost Android smartphone (e.g., Tecno, Infinix, itel)
- **Network Tier:** Ethio Telecom / Safaricom 2G/3G
- **Unaided Task Completion (Yes / No / Partial):** `________`
- **Time to Complete Main Task:** `________ minutes`

#### Detailed Observations
| Checkpoint | Observation / Participant Reaction | Friction Point / Failure | Required Engineering Fix |
|---|---|---|---|
| 320px viewport reflow & horizontal scroll check | | | |
| 200% browser text scaling behaviour | | | |
| Data meter transparency prior to download | | | |
| Offline bundle unzipping & local execution | | | |
| Dual Ethiopian/Gregorian calendar rendering | | | |

#### Participant Rating & Direct Feedback
- **Ease of Use (1-5):** `[ ]`
- **Autonomy / Independence (1-5):** `[ ]`
- **Participant's Own Words / Notes:**  
  > *"________________________________________________________________"*
- **Facilitator Signature / Date:** `____________________`
