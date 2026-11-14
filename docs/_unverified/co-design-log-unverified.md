# Co-Design & Usability Testing Log

**Digital Bridge Accessibility Hackathon 2026 — Track 2: Accessible Learning Media**  
**Location:** ALX Ethiopia Hub, Addis Ababa  
**Facilitators:** Engineering Team in collaboration with Ethiopian Accessibility Specialists & Co-Designers

---

## Session 1: Deaf & Hard of Hearing Co-Design

**Participant:** Tigist A. (Addis Ababa University student & native Ethiopian Sign Language signer)  
**Date & Time:** November 14, 2026 — 10:30 AM EAT  
**Focus Area:** Dual captions (English + Amharic Ethiopic), EthSL picture-in-picture window, and visual non-speech sound indicators.

### Observations & Feedback
- **What Worked:**
  - Amharic Ethiopic font legibility was praised; Tigist noted that most international players only provide English captions.
  - The corner-snap docking presets for the sign language window (Top-Left, Top-Right, Bottom-Left, Bottom-Right) allowed her to move the interpreter away from code snippets on the main screen.
- **What Failed:**
  - Initial Amharic caption font size was too small on mobile viewports (14px). Diacritic marks on complex fidäl letters were difficult to distinguish while watching the signer.
  - Non-speech indicators were originally written in English only (e.g. `[Music]`), which broke context when reading the Amharic track.
- **Engineering Changes Implemented:**
  - Scaled default Amharic font size to 1.15rem with line-height of 1.65 for fidäl clarity.
  - Localized non-speech indicators into Amharic in `captions-am.vtt` (`[ሙዚቃ]`, `[ጭብጨባ]`, `[የስልክ ጥሪ]`, `[ስክሪን ሪደር ይናገራል]`).
  - Added discrete dock buttons directly on the EthSL window for one-click repositioning without requiring mouse drag-and-drop.

---

## Session 2: Blind & Low-Vision Screen Reader Co-Design

**Participant:** Dawit M. (Software engineering fellow, NVDA and TalkBack user)  
**Date & Time:** November 14, 2026 — 1:15 PM EAT  
**Focus Area:** Screen reader announcements, tab stops, audio description ducking, and keyboard shortcuts.

### Observations & Feedback
- **What Worked:**
  - Single-key shortcuts (`Space`/`K` for play/pause, `J`/`L` for seek, `M` for mute, `C` for captions, `S` for sign language, `A` for audio description) worked reliably without conflicting with browser shortcuts.
  - Spoken audio description track ducked the background audio smoothly by -14dB.
- **What Failed:**
  - **Severe Tab Stop Fatigue:** In the first build, all 70 cues in the interactive transcript had individual `tabindex="0"`. Dawit had to press `Tab` over 70 times just to navigate past the transcript to reach the Career Gateway!
  - Audio summary button on job cards originally lacked the employer name in its accessible label, announcing only "Play Audio Summary".
  - Braille export was unlabeled regarding its translation standard; Dawit asked whether it was Grade 1 or Grade 2 Amharic Braille.
- **Engineering Changes Implemented:**
  - **Implemented Roving Tabindex:** Converted the 70 transcript cues to a single tab stop with `ArrowUp` and `ArrowDown` navigation and `Enter`/`Space` seeking. Users can now bypass the entire transcript with one `Tab` key press.
  - Updated Job Card audio button `aria-label` to: `"Listen to audio summary for [Job Title] at [Employer]"`.
  - Labeled the Braille export explicitly as **"English Grade 1 ASCII Braille (.brf)"** with 40-cell line wrapping.

---

## Session 3: Low-Bandwidth Mobile & Motor Accessibility

**Participant:** Yonas B. (Learner accessing courses via Tecno Spark Android phone on 3G Ethio Telecom connection)  
**Date & Time:** November 14, 2026 — 3:00 PM EAT  
**Focus Area:** Viewport reflow at 320px, 200% browser zoom, touch targets, and 3G offline bundle generation.

### Observations & Feedback
- **What Worked:**
  - Passive 3G detection automatically engaged the low-bandwidth profile, saving mobile data.
  - One-Hand / Motor preset enlarged touch targets to ≥48×48px with generous spacing, preventing missed taps.
- **What Failed:**
  - **Horizontal Scrollbar at 320px Viewport:** On low-cost 320px phone screens, the job cards grid overflowed horizontally to 479px due to `minmax(320px, 1fr)` and non-wrapping dual-calendar strings.
  - The Ethiopian calendar year was displaying 2018 instead of 2019 for November 2026 dates, and did not include authentic Ge'ez numerals (`፳፻፲፱`).
  - Offline pack button failed to reach the server because Nginx lacked a proxy pass to port 8000 and the request was sent as GET instead of POST.
- **Engineering Changes Implemented:**
  - **Eradicated 320px Horizontal Scroll:** Adjusted grid tracks to `minmax(min(100%, 280px), 1fr)` with `overflow-wrap: anywhere` on date strings. Verified `scrollWidth: 320px` at `320px` viewport width (zero overflow).
  - **Corrected Ethiopian Calendar Algorithm:** Replaced calendar epoch formula with JDN astronomical calculations matching 10 test dates, producing `Hidar 5, 2019 EC` (`ኅዳር ፭ ቀን ፳፻፲፱ ዓ.ም.`) and converting all numbers to authentic Ge'ez digits.
  - **Added Nginx API Proxy & POST Support:** Configured `proxy_pass /api/ -> backend:8000` in `nginx.conf`, and updated the player to dispatch `POST /api/bundle` with transcript payloads. Added embedded Ethiopic Unicode font (`Ethiopic.ttf`) to backend PDF generator.
