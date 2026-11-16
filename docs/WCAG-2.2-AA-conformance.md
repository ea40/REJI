# WCAG 2.2 Level AA — criterion-by-criterion conformance

**Product:** Digital Bridge Accessible Learning Media & Career Gateway
**Version:** 1.0.0-hackathon
**Date:** 16 November 2026
**Scope:** `index.html`, `frontend/demo.html`, `frontend/studio.html`, `savanna/pages/*.html`,
`demo/blank.html`, `demo/embed.html`, the `<db-player>` / `<db-job-card>` components, and the
spoken-navigation layer (`frontend/assets/tts-navigator.js`, `frontend/assets/speech-arbiter.js`).

## How to read this table

| Status | Meaning |
|---|---|
| **Supports** | Verified in this repository by an executed automated test or a code inspection recorded below. |
| **Partially supports** | Works for the stated cases; the gap is named in the notes. |
| **Not applicable** | The success criterion does not apply to this product. |
| **NOT YET TESTED** | Requires a human or a device we could not run. The owner is named. |

No claim in this document is based on an unexecuted test. Screen-reader and audible-speech rows are
**not tested**: the project has no NVDA, JAWS or TalkBack session and the engineers cannot hear the
synthesiser output.

## Automated evidence

| Check | Command | Result |
|---|---|---|
| Playwright + axe-core suite | `cd tests && npm test` | see the count printed by the run recorded in the merge report |
| Keyboard shortcuts (code-based, non-Latin layout) | `tests/tts-navigator.spec.js` | passing |
| WCAG 2.1.4 letter-key switch | `tests/tts-navigator.spec.js` | passing |
| Focus not obscured (2.4.11) at 320 px / 200 % | `tests/tts-navigator.spec.js` | passing |
| Guide dialog focus trap + Esc + focus return | `tests/tts-navigator.spec.js` | passing |
| Audio description not cancelled by UI speech | `tests/audio-description.spec.js` | passing |
| No-voice fallback for audio description | `tests/audio-description.spec.js` | passing |
| axe-core zero critical/serious with panel and guide open and closed | `tests/tts-navigator.spec.js` | passing |

## Level A and AA

| SC | Name | Level | Status | Notes / how tested |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | Partially supports | Player posters, page images and icons carry `alt`/`aria-label`; decorative SVGs are `aria-hidden="true"`. **Gap:** the generated offline `output_pack/reader.html` contains no `alt` attributes or `<figcaption>` (0 of each, measured) — offline reader image descriptions are outstanding. |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | Supports | `output_pack/transcript-en.json`, `transcript-am.json`, in-player interactive transcript. |
| 1.2.2 | Captions (Prerecorded) | A | Supports | `frontend/assets/captions-en.vtt` and `captions-am.vtt`; language switch and dual mode in `frontend/digital-bridge-player.js`. |
| 1.2.3 | Audio Description or Media Alternative | A | Supports | Recorded/ducked AD track (`audio-src`, Web Audio ducking) plus the Web Speech fallback. Behaviour covered by `tests/audio-description.spec.js`. |
| 1.2.4 | Captions (Live) | AA | Not applicable | No live broadcast. The optional live dictation mode is a learner aid, not a broadcast caption feed. |
| 1.2.5 | Audio Description (Prerecorded) | AA | Supports | As 1.2.3; extended audio description setting (default on) pauses the video instead of truncating a cue. |
| 1.3.1 | Info and Relationships | A | Supports | Semantic landmarks, headings, lists and tables in the player shadow DOM and documents; axe-core structural rules pass. |
| 1.3.2 | Meaningful Sequence | A | Supports | DOM order matches visual order; transcript and chat are lists. |
| 1.3.3 | Sensory Characteristics | A | Supports | Instructions name keys and controls, not colour or position alone. |
| 1.3.4 | Orientation | AA | Supports | No orientation lock; layout reflows (see 1.4.10). |
| 1.3.5 | Identify Input Purpose | AA | Partially supports | Studio and search inputs have visible labels; `autocomplete` is not set on every field. |
| 1.4.1 | Use of Colour | A | Supports | States also carry text/`aria-pressed`, not colour alone. |
| 1.4.3 | Contrast (Minimum) | AA | Supports | axe-core `color-contrast` passes on every audited page and on the new TTS panel, notice and guide (both open and closed states). |
| 1.4.4 | Resize Text | AA | Supports | 200 % text zoom tests in `tests/accessibility.spec.js` and `tests/tts-navigator.spec.js`. |
| 1.4.5 | Images of Text | AA | Partially supports | Headings and controls are text; lesson poster and some brand imagery are images. |
| 1.4.10 | Reflow | AA | Supports | 320 px and 200 % zoom tests including the fixed TTS panel (no horizontal scroll, panel width ≤ viewport). |
| 1.4.11 | Non-text Contrast | AA | Partially supports | Focus rings use `#FFE14D` (≈13:1 against the panel background) and a 6 px halo; no automated tool checks non-text contrast, so this is inspection only. |
| 1.4.12 | Text Spacing | AA | NOT YET TESTED | owner: Lead Engineer. Needs a text-spacing override run. |
| 1.4.13 | Content on Hover or Focus | AA | Partially supports | Tooltips are dismissible by Escape in the player; not exhaustively verified. |
| 2.1.1 | Keyboard | A | Supports | Every control is reachable; `tests/accessibility.spec.js` keyboard tests plus `tests/tts-navigator.spec.js`. |
| 2.1.2 | No Keyboard Trap | A | Supports | `Cross-cutting — No Keyboard Traps` test; the guide dialog traps focus intentionally and releases on Escape. |
| 2.1.4 | Character Key Shortcuts | A | Supports | Single-letter shortcuts can be switched off from the panel, the key guide and the first-visit notice; stored in `localStorage` (`db-tts-letter-keys`). Tested in `tests/tts-navigator.spec.js`. |
| 2.2.1 | Timing Adjustable | A | Not applicable | No time limits on content. |
| 2.2.2 | Pause, Stop, Hide | A | Supports | Player pause/stop; speech can be stopped with Escape or the Stop button. |
| 2.3.1 | Three Flashes or Below Threshold | A | Supports | No flashing content. |
| 2.4.1 | Bypass Blocks | A | Supports | Skip link on every page; landmarks; the TTS layer injects a first-tab-stop control. |
| 2.4.2 | Page Titled | A | Supports | Unique `<title>` per page. |
| 2.4.3 | Focus Order | A | Supports | DOM order; the injected TTS controls come first by design. |
| 2.4.4 | Link Purpose (In Context) | A | Supports | Link text is descriptive; icon-only links carry `aria-label`. |
| 2.4.5 | Multiple Ways | AA | Partially supports | In-page search/command palette plus in-page navigation; no sitemap. |
| 2.4.6 | Headings and Labels | AA | Supports | Heading order and labels audited by axe-core. |
| 2.4.7 | Focus Visible | AA | Supports | `:focus-visible` outline on every interactive element; TTS highlight adds a second ring. |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | Supports | The fixed TTS panel reserves `scroll-padding-bottom`; verified at 320 px and 200 % zoom in `tests/tts-navigator.spec.js`. |
| 2.5.1 | Pointer Gestures | A | Supports | Multi-point/path gestures are not required; dock buttons and ± resize buttons replace dragging. |
| 2.5.2 | Pointer Cancellation | A | Supports | Actions fire on click/up, not on down. |
| 2.5.3 | Label in Name | A | Supports | Visible labels are contained in accessible names. |
| 2.5.4 | Motion Actuation | A | Not applicable | No device-motion input. |
| 2.5.7 | Dragging Movements | AA | Supports | Keyboard arrows and discrete dock/resize buttons provide single-pointer alternatives. |
| 2.5.8 | Target Size (Minimum) | AA | Supports | TTS panel controls are ≥ 28 px high with 6 px spacing; player controls are 44 px (48 px in the motor preset). Text links are inline and exempt. |
| 3.1.1 | Language of Page | A | Supports | `lang` on every document. |
| 3.1.2 | Language of Parts | AA | Supports | Amharic segments and UI strings declare `lang="am"`. |
| 3.2.1 | On Focus | A | Supports | No context change on focus; TTS only announces. |
| 3.2.2 | On Input | A | Supports | Filters update results without unexpected context changes. |
| 3.2.3 | Consistent Navigation | AA | Supports | Shared header/footer and the same TTS controls across pages. |
| 3.2.4 | Consistent Identification | AA | Supports | Same icons/labels for the same actions across the player and pages. |
| 3.2.6 | Consistent Help | A | Supports | The "Keys and speech" control is the first tab stop on every page that loads the layer. |
| 3.3.1 | Error Identification | A | Partially supports | Backend returns structured errors; the studio has no validation errors to report. |
| 3.3.2 | Labels or Instructions | A | Supports | Every form control has a label or `aria-label`. |
| 3.3.3 | Error Suggestion | AA | Partially supports | API errors are descriptive; no corrective suggestions in the studio. |
| 3.3.4 | Error Prevention | AA | Not applicable | No legal/financial submissions in the UI. |
| 3.3.7 | Redundant Entry | A | Not applicable | No multi-step forms. |
| 4.1.2 | Name, Role, Value | A | Supports | axe-core `aria-*` and form rules pass, including the panel toggles (`aria-pressed`) and the guide dialog name. |
| 4.1.3 | Status Messages | AA | Supports | Polite live regions for player status and for the TTS layer when speech is unavailable; `role="status"` on dynamic text. |

## Rows that need a human

| Item | Status | Owner |
|---|---|---|
| NVDA on Windows: complete the main task unaided | **NOT YET TESTED** | owner: Lead Engineer (co-designer session, `docs/co-design-log.md`) |
| TalkBack on a low-cost Android phone: complete the main task unaided | **NOT YET TESTED** | owner: Lead Engineer |
| Audible check that the TTS navigator, key guide and audio description are intelligible and not clipped | **NOT YET TESTED** | owner: Lead Engineer |
| Amharic speech output on a device with an Amharic voice installed | **NOT YET TESTED** | owner: Lead Engineer |
| 1.4.12 Text Spacing override run | **NOT YET TESTED** | owner: Lead Engineer |

## Manual test scripts

### A. Listening test (no screen reader, ~10 minutes)

1. Open `index.html` in Chrome with sound on. Expect a spoken welcome naming the page and the number of headings, then instructions for `?` and `G` then `S`.
2. Press `Tab`. Each stop should be spoken: "Link, …", "Button, …", with state words such as "pressed".
3. Press `H` five times, then `Shift+H` five times. Every stop should name a heading and its position ("3 of 6").
4. Press `D`, `L`, `B`, `F`, `T` once each and confirm the announcement matches what got focus.
5. Press `G` then `S`; speech should stop and the panel should read "Speech: Off". Press `G` then `S` again.
6. Press `?`; the guide should open and the first row should be spoken. Tab through three rows and press Enter on one.
7. Press `Escape`; speech must stop instantly and focus must return to "Keys and speech".
8. Open `frontend/demo.html`, enable AD (press `A` inside the player), then change focus with `Tab` repeatedly **during** a cue. The cue must finish; the navigation announcement must not cut it.
9. Pause and play the video during a cue. Speech must pause and resume with the video. Seek and confirm the description restarts from the new position.

### B. Screen-reader test (~20 minutes)

1. Start NVDA (Windows) or TalkBack (Android). Open `index.html`.
2. When the first-visit notice appears, Tab to "I already use NVDA, JAWS or TalkBack" and press Enter. The page must not speak on its own afterwards, and single letters must not move focus.
3. Walk the page with the screen reader only: headings list contains every visible heading once; landmarks are named; the player controls announce name, role and state.
4. With the player focused in forms mode, confirm `Space`, `J`, `L`, `M`, `C`, `S`, `A`, `F` still control the video.
5. Confirm the audio-description cue and the screen reader do not talk over each other.
6. Record the outcome in `docs/co-design-log.md`; this file must not claim the result before that session happens.
