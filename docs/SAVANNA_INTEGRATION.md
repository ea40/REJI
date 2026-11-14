# ALX Savanna Static Pages — Verified Integration Guide

This guide details how to integrate the **Digital Bridge Accessible Media Player** (`<digital-bridge-player>`) and **Career Gateway Card** (`<digital-bridge-job-card>`) into the official ALX Savanna static pages repository (`alx-africa/Savanna-static-pages`).

---

## 1. Verified Target Pages in Savanna-static-pages

Unlike mock documentation that referenced non-existent files, this integration targets verified existing files in `alx-africa/Savanna-static-pages`:
- **Primary Lesson Page:** `pages/concept-with-navigation.html` ("Concept page: The Future of the VA Industry")
- **Course Homepage:** `pages/homepage-v1-paced.html`
- **Catalog Index:** `index.html`

---

## 2. Integrating `<digital-bridge-player>` into `pages/concept-with-navigation.html`

In `pages/concept-with-navigation.html`, the curriculum concept is displayed under the main content body. Currently, the page includes video styling (`video-js` CSS in the `<head>`) but lacks an accessible video learning player.

### Step 1: Add the Component Script
Before the closing `</body>` tag of `pages/concept-with-navigation.html`:

```html
<!-- Digital Bridge Accessible Web Components -->
<script src="../js/digital-bridge-player.js"></script>
```

### Step 2: Embed the Player in the Lesson Content Container
Insert the `<digital-bridge-player>` element directly into the lesson content wrapper:

```html
<div class="card p-4 my-4 shadow-sm">
  <h2 class="h4 mb-3">Lesson Media: Virtual Assistant Career Pathways</h2>
  <digital-bridge-player
    lesson-title="The Future of the VA Industry"
    captions-en="../assets/captions-en.vtt"
    captions-am="../assets/captions-am.vtt"
    chat-log="../assets/chat-log.json"
    preset="standard"
  ></digital-bridge-player>
</div>
```

### Why This Works Seamlessly in Savanna:
- **Shadow DOM Encapsulation:** Savanna's `assets/css/application_alx.css` (1.3 MB Bootstrap stylesheet) cannot bleed into player controls or override focus rings.
- **Zero Style Collisions:** The 3px `#00FF88` accessible focus indicator remains intact.
- **Pure Client Execution:** Requires no build step, Node server, or external CDN.

---

## 3. Integrating `<digital-bridge-job-card>` into Savanna Alumni / Career Sections

To display accessible job opportunities connected to course certificates:

### Step 1: Add the Job Card Script
```html
<script src="../js/digital-bridge-job-card.js"></script>
```

### Step 2: Embed the Job Card
```html
<div class="row my-4">
  <div class="col-12 col-md-6 mb-3">
    <digital-bridge-job-card
      job-title="Junior Accessibility QA Engineer"
      employer="Chapa Financial Technologies"
      location="Bole Medhanialem, Addis Ababa"
      salary="45,000 – 65,000 ETB / month"
      deadline="2027-03-31"
      accommodations="Screen reader audited workstations, flexible hybrid schedule"
      badge-url="../assets/sample-badge.json"
      description="Help audit and maintain digital financial products ensuring full compliance with Ethiopian Communications Authority (ECA) accessibility principles and WCAG 2.2 AA standards."
    ></digital-bridge-job-card>
  </div>
</div>
```

---

## 4. Verification Checkpoints
1. Open `Savanna-static-pages/pages/concept-with-navigation.html` in browser.
2. Confirm player renders with full keyboard navigation (`Tab`, `Space`, `C`, `S`, `M`).
3. Confirm job card reflows responsively on 320px mobile viewport without horizontal scrolling.
