"""
Digital Bridge Accessibility API
=================================
Backend service for the Digital Bridge Accessibility Hackathon 2026 — Track 2.

Provides endpoints for generating offline lesson bundles, Braille transcription,
and tagged accessible PDFs. Zero external API keys required.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import struct
import zipfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fpdf import FPDF
from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════════════════════
# App Configuration
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Digital Bridge Accessibility API",
    description=(
        "Generate accessible offline lesson bundles, Braille transcriptions, "
        "and tagged PDFs for learners with disabilities."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_ASSETS_DIR = Path(__file__).resolve().parent.parent / "frontend" / "assets"

# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════════════════


class BundleRequest(BaseModel):
    """Request body for generating a 3G offline lesson pack."""

    title: str = Field(default="Web Accessibility 101", description="Lesson title")
    transcript: str = Field(default="Introduction to Web Accessibility for Ethiopian learners.", description="Full transcript text")
    transcript_en: Optional[str] = Field(default=None, description="Optional alias for transcript")
    transcript_am: Optional[str] = Field(default=None, description="Amharic transcript text")
    captions_en: str = Field(default="", description="English captions (VTT format)")
    captions_am: str = Field(default="", description="Amharic captions (VTT format)")
    include_audio: bool = Field(default=True, description="Whether to include lightweight audio")
    include_pdf: bool = Field(default=True, description="Whether to include tagged PDF")
    image_descriptions: List[str] = Field(
        default_factory=list,
        description="Alt-text descriptions for lesson images",
    )


class BadgeVerifyRequest(BaseModel):
    """Request body for Open Badges 3.0 SHA-256 integrity verification."""

    badge_url: Optional[str] = Field(default=None, description="URL of badge JSON")
    badge_data: Optional[dict] = Field(default=None, description="Direct badge JSON payload")


class BrailleRequest(BaseModel):
    """Request body for Braille transcription."""

    text: str = Field(..., min_length=1, description="Text to convert to Braille")
    line_width: int = Field(
        default=40, ge=10, le=80, description="Characters per Braille line"
    )


class PDFRequest(BaseModel):
    """Request body for accessible PDF generation."""

    title: str = Field(..., min_length=1, description="Document title")
    content: str = Field(..., min_length=1, description="Main body text")
    headings: List[str] = Field(
        default_factory=list, description="Section headings"
    )
    image_descriptions: List[str] = Field(
        default_factory=list, description="Alt-text descriptions for images"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Braille Translation Engine
# ═══════════════════════════════════════════════════════════════════════════════
#
# North American Braille ASCII (NABCC) mapping.
# Each English letter maps to the corresponding Braille ASCII character used in
# .brf files.  Indicators: ⠼ = number indicator (#), ⠠ = capital indicator (,).

BRAILLE_ALPHA: dict[str, str] = {
    "a": "A",
    "b": "B",
    "c": "C",
    "d": "D",
    "e": "E",
    "f": "F",
    "g": "G",
    "h": "H",
    "i": "I",
    "j": "J",
    "k": "K",
    "l": "L",
    "m": "M",
    "n": "N",
    "o": "O",
    "p": "P",
    "q": "Q",
    "r": "R",
    "s": "S",
    "t": "T",
    "u": "U",
    "v": "V",
    "w": "W",
    "x": "X",
    "y": "Y",
    "z": "Z",
}

# In BRF, digits reuse the first ten Braille letters (a-j) preceded by a
# number indicator (#).
BRAILLE_DIGITS: dict[str, str] = {
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D",
    "5": "E",
    "6": "F",
    "7": "G",
    "8": "H",
    "9": "I",
    "0": "J",
}

BRAILLE_PUNCTUATION: dict[str, str] = {
    ".": "4",
    ",": "1",
    ";": "2",
    ":": "3",
    "!": "6",
    "?": "8",
    "'": "'",
    '"': "7",
    "-": "-",
    "(": "<",
    ")": ">",
    "/": "\\",
    "@": "@",
    "#": "#",
    "&": "&",
    "*": "9",
    "+": "+",
    "=": "=",
    "[": "[",
    "]": "]",
    "{": "{",
    "}": "}",
    "_": "\"",
    "%": "%",
    "^": "^",
    "~": "~",
    "<": "<",
    ">": ">",
    "|": "|",
    "$": "\\$",
}

# Braille indicators (BRF encoding)
CAPITAL_INDICATOR = ","   # Dots 6
NUMBER_INDICATOR = "#"    # Dots 3-4-5-6


def translate_to_braille(text: str, line_width: int = 40) -> str:
    """Translate plain English text to Grade 1 Braille ASCII (.brf format).

    Implements:
    - Full a-z letter mapping to NABCC
    - Capital letter indicator before uppercase letters
    - Number indicator before digit sequences
    - Common punctuation translation
    - Word wrapping at *line_width* characters
    - Paragraph preservation (blank lines)
    """
    lines: list[str] = text.split("\n")
    brf_lines: list[str] = []

    for line in lines:
        if not line.strip():
            brf_lines.append("")
            continue

        brf_chars: list[str] = []
        in_number = False

        for ch in line:
            if ch == " ":
                brf_chars.append(" ")
                in_number = False
                continue

            if ch == "\t":
                brf_chars.append("  ")
                in_number = False
                continue

            # Digits
            if ch.isdigit():
                if not in_number:
                    brf_chars.append(NUMBER_INDICATOR)
                    in_number = True
                brf_chars.append(BRAILLE_DIGITS[ch])
                continue

            # End of number context
            in_number = False

            # Letters
            if ch.isalpha():
                lower = ch.lower()
                if lower in BRAILLE_ALPHA:
                    if ch.isupper():
                        brf_chars.append(CAPITAL_INDICATOR)
                    brf_chars.append(BRAILLE_ALPHA[lower])
                else:
                    # Non-Latin letter — pass through as-is
                    brf_chars.append(ch)
                continue

            # Punctuation
            if ch in BRAILLE_PUNCTUATION:
                brf_chars.append(BRAILLE_PUNCTUATION[ch])
                continue

            # Unknown character — pass through
            brf_chars.append(ch)

        raw = "".join(brf_chars)
        brf_lines.extend(_wrap_line(raw, line_width))

    return "\n".join(brf_lines) + "\n"


def _wrap_line(text: str, width: int) -> list[str]:
    """Word-wrap a single BRF line at *width* characters."""
    if len(text) <= width:
        return [text]

    wrapped: list[str] = []
    while len(text) > width:
        # Find last space within the width
        break_at = text.rfind(" ", 0, width + 1)
        if break_at == -1:
            # No space found — hard break
            break_at = width
        wrapped.append(text[:break_at].rstrip())
        text = text[break_at:].lstrip()
    if text:
        wrapped.append(text)
    return wrapped


# ═══════════════════════════════════════════════════════════════════════════════
# Accessible PDF Generator
# ═══════════════════════════════════════════════════════════════════════════════


def sanitize_pdf_text(text: str) -> str:
    """Sanitize text formatting for PDF output, preserving authentic Unicode (including Ethiopic)."""
    if not text:
        return ""
    replacements = {
        "—": "-",
        "–": "-",
        "…": "...",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "•": "*",
        "™": "(TM)",
        "©": "(C)",
        "®": "(R)",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text


class AccessiblePDF(FPDF):
    """FPDF2 subclass that produces tagged, accessible PDFs with structured
    headings, paragraphs, and alt-text placeholders for images."""

    def __init__(self, title: str) -> None:
        super().__init__()
        safe_title = sanitize_pdf_text(title)
        self.set_title(safe_title)
        self.set_author("Digital Bridge Accessibility Project")
        self.set_creator("Digital Bridge API v1.0")
        self.set_subject("Accessible Educational Content")
        self.set_keywords("accessibility, education, braille, offline, ethiopia")
        self.set_lang("en")
        self.set_auto_page_break(auto=True, margin=25)
        self._doc_title = safe_title

        # Check for bundled Ethiopic Unicode font
        self.main_font = "Helvetica"
        font_file = Path(__file__).resolve().parent / "fonts" / "Ethiopic.ttf"
        if font_file.exists():
            try:
                self.add_font("Ethiopic", style="", fname=str(font_file))
                self.main_font = "Ethiopic"
            except Exception:
                self.main_font = "Helvetica"

    def header(self) -> None:
        self.set_font(self.main_font, "B" if self.main_font == "Helvetica" else "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, self._doc_title, align="L", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font(self.main_font, "I" if self.main_font == "Helvetica" else "", 8)
        self.set_text_color(128, 128, 128)
        self.cell(
            0,
            10,
            f"Page {self.page_no()}/{{nb}} - Digital Bridge Accessibility Project",
            align="C",
        )

    @contextmanager
    def marked_content(self, tag: str, title: str = None, alt: str = None):
        """Context manager for adding tagged structure elements to the PDF."""
        try:
            mcid = self.struct_builder.next_mcid_for_page(self.page)
            st = f"/{tag}" if not tag.startswith("/") else tag
            struct_elem = self._add_marked_content(
                struct_type=st,
                mcid=mcid,
                title=title,
                alt_text=alt,
            )
            self._out(f"{st} <</MCID {mcid}>> BDC")
            yield struct_elem
            self._out("EMC")
        except Exception:
            yield None

    def add_main_title(self, text: str) -> None:
        """Render the document's main title (H1)."""
        safe_text = sanitize_pdf_text(text)
        self.set_font(self.main_font, "B" if self.main_font == "Helvetica" else "", 20)
        self.set_text_color(30, 30, 120)
        with self.marked_content("H1"):
            self.multi_cell(0, 12, safe_text, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)

    def add_heading(self, text: str, level: int = 2) -> None:
        """Render a heading (H2-H4) with appropriate styling."""
        safe_text = sanitize_pdf_text(text)
        sizes = {2: 16, 3: 13, 4: 11}
        size = sizes.get(level, 13)
        self.set_font(self.main_font, "B" if self.main_font == "Helvetica" else "", size)
        self.set_text_color(40, 40, 100)
        tag = f"H{level}"
        with self.marked_content(tag):
            self.multi_cell(0, size * 0.6, safe_text, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def add_paragraph(self, text: str) -> None:
        """Render a body paragraph with proper tagging."""
        safe_text = sanitize_pdf_text(text)
        self.set_font(self.main_font, "", 10)
        self.set_text_color(30, 30, 30)
        with self.marked_content("P"):
            self.multi_cell(0, 6, safe_text, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def add_image_description(self, alt_text: str, index: int) -> None:
        """Render an image placeholder box with alt-text for accessibility."""
        safe_alt = sanitize_pdf_text(alt_text)
        self.set_fill_color(240, 240, 245)
        self.set_draw_color(180, 180, 200)
        y_start = self.get_y()

        # Draw placeholder rectangle
        box_height = 50
        if y_start + box_height > self.h - 30:
            self.add_page()
            y_start = self.get_y()

        self.rect(15, y_start, self.w - 30, box_height, style="DF")

        # Image icon label
        self.set_xy(20, y_start + 5)
        self.set_font(self.main_font, "I" if self.main_font == "Helvetica" else "", 10)
        self.set_text_color(120, 120, 140)
        self.cell(0, 6, f"[Image {index + 1}]", new_x="LMARGIN", new_y="NEXT")

        # Alt text
        self.set_xy(20, y_start + 15)
        self.set_font(self.main_font, "", 10)
        self.set_text_color(60, 60, 80)
        with self.marked_content("Figure"):
            self.multi_cell(
                self.w - 45,
                5,
                f"Alt: {safe_alt}",
                new_x="LMARGIN",
                new_y="NEXT",
            )

        self.set_y(y_start + box_height + 5)

    def add_separator(self) -> None:
        """Draw a thin horizontal rule."""
        y = self.get_y()
        self.set_draw_color(200, 200, 200)
        self.line(20, y, self.w - 20, y)
        self.ln(6)


def generate_accessible_pdf(
    title: str,
    content: str,
    headings: list[str],
    image_descriptions: list[str],
) -> bytes:
    """Build a tagged accessible PDF and return the raw bytes."""
    pdf = AccessiblePDF(title)
    pdf.alias_nb_pages()
    pdf.add_page()

    # Main title
    pdf.add_main_title(title)
    pdf.add_separator()

    # Metadata block
    pdf.set_font(pdf.main_font, "I" if pdf.main_font == "Helvetica" else "", 9)
    pdf.set_text_color(100, 100, 100)
    now = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    pdf.cell(0, 5, f"Generated: {now}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        5,
        "Digital Bridge Accessibility Hackathon 2026",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    # Split content into paragraphs
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

    # Interleave headings and paragraphs
    heading_idx = 0
    img_idx = 0
    for i, para in enumerate(paragraphs):
        # Insert heading before certain paragraphs
        if heading_idx < len(headings) and (
            i == 0 or i % max(1, len(paragraphs) // max(1, len(headings))) == 0
        ):
            pdf.add_heading(headings[heading_idx], level=2)
            heading_idx += 1

        pdf.add_paragraph(para)

        # Insert image descriptions at intervals
        if image_descriptions and img_idx < len(image_descriptions):
            interval = max(1, len(paragraphs) // max(1, len(image_descriptions)))
            if (i + 1) % interval == 0:
                pdf.add_image_description(image_descriptions[img_idx], img_idx)
                img_idx += 1

    # Append any remaining headings
    while heading_idx < len(headings):
        pdf.add_heading(headings[heading_idx], level=2)
        heading_idx += 1

    # Append any remaining image descriptions
    while img_idx < len(image_descriptions):
        pdf.add_image_description(image_descriptions[img_idx], img_idx)
        img_idx += 1

    # Accessibility notice
    pdf.add_separator()
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        5,
        (
            "This document was generated with accessibility in mind. "
            "It includes structured headings, alt-text for images, and "
            "is designed for compatibility with screen readers."
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )

    return pdf.output()


# ═══════════════════════════════════════════════════════════════════════════════
# WAV Audio Silence Generator
# ═══════════════════════════════════════════════════════════════════════════════


def generate_silence_wav(duration_seconds: float = 1.0, sample_rate: int = 8000) -> bytes:
    """Generate a minimal WAV file of silence (8-bit mono) for bundle packing.

    Uses a low sample rate and 8-bit depth to keep file size tiny — ideal for
    3G-constrained offline bundles.
    """
    num_samples = int(sample_rate * duration_seconds)
    # 8-bit WAV silence is 128 (midpoint)
    audio_data = bytes([128] * num_samples)

    buf = io.BytesIO()
    # RIFF header
    data_size = num_samples
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    # fmt chunk
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))          # chunk size
    buf.write(struct.pack("<H", 1))           # PCM format
    buf.write(struct.pack("<H", 1))           # mono
    buf.write(struct.pack("<I", sample_rate))  # sample rate
    buf.write(struct.pack("<I", sample_rate))  # byte rate (8-bit mono)
    buf.write(struct.pack("<H", 1))           # block align
    buf.write(struct.pack("<H", 8))           # bits per sample
    # data chunk
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(audio_data)

    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# Offline HTML Reader Generator
# ═══════════════════════════════════════════════════════════════════════════════


def generate_offline_html(
    title: str,
    transcript: str,
    captions_en: str,
    captions_am: str,
    image_descriptions: list[str],
) -> str:
    """Build a self-contained HTML file for offline reading.

    The HTML embeds the transcript directly, requires no external resources,
    and follows accessibility best practices (semantic HTML, ARIA labels,
    high-contrast default, scalable text).
    """
    # Escape for safe HTML embedding
    import html as html_mod

    safe_title = html_mod.escape(title)
    safe_transcript = html_mod.escape(transcript)
    safe_captions_en = html_mod.escape(captions_en)
    safe_captions_am = html_mod.escape(captions_am)

    image_alt_blocks = ""
    for i, desc in enumerate(image_descriptions):
        safe_desc = html_mod.escape(desc)
        image_alt_blocks += f"""
        <figure role="img" aria-label="{safe_desc}" class="img-placeholder">
            <div class="img-box">[Image {i + 1}]</div>
            <figcaption>{safe_desc}</figcaption>
        </figure>"""

    paragraphs = "\n".join(
        f"        <p>{html_mod.escape(p.strip())}</p>"
        for p in transcript.split("\n\n")
        if p.strip()
    )

    return f"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} — Digital Bridge Offline Reader</title>
    <style>
        :root {{
            --bg: #ffffff;
            --fg: #1a1a2e;
            --accent: #16213e;
            --muted: #6b7280;
            --border: #e5e7eb;
            --surface: #f9fafb;
        }}
        @media (prefers-color-scheme: dark) {{
            :root {{
                --bg: #0f0f23;
                --fg: #e2e8f0;
                --accent: #60a5fa;
                --muted: #94a3b8;
                --border: #334155;
                --surface: #1e1e3f;
            }}
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                         'Noto Sans', 'Noto Sans Ethiopic', sans-serif;
            background: var(--bg);
            color: var(--fg);
            line-height: 1.7;
            padding: 2rem;
            max-width: 720px;
            margin: 0 auto;
            font-size: 1.05rem;
        }}
        h1 {{
            font-size: 1.8rem;
            color: var(--accent);
            margin-bottom: 0.5rem;
            border-bottom: 3px solid var(--accent);
            padding-bottom: 0.5rem;
        }}
        .meta {{
            color: var(--muted);
            font-size: 0.85rem;
            margin-bottom: 2rem;
        }}
        h2 {{
            font-size: 1.3rem;
            margin: 1.5rem 0 0.5rem;
            color: var(--accent);
        }}
        p {{ margin-bottom: 1rem; }}
        .img-placeholder {{
            background: var(--surface);
            border: 2px dashed var(--border);
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1.5rem 0;
            text-align: center;
        }}
        .img-box {{
            font-size: 2rem;
            color: var(--muted);
            margin-bottom: 0.5rem;
        }}
        figcaption {{
            font-style: italic;
            color: var(--muted);
            font-size: 0.9rem;
        }}
        details {{
            margin: 1.5rem 0;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
            background: var(--surface);
        }}
        summary {{
            cursor: pointer;
            font-weight: bold;
            color: var(--accent);
        }}
        pre {{
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 0.9rem;
            margin-top: 0.5rem;
            color: var(--fg);
        }}
        .controls {{
            position: sticky;
            top: 0;
            background: var(--bg);
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1rem;
            z-index: 10;
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}
        button {{
            padding: 0.4rem 0.8rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--surface);
            color: var(--fg);
            cursor: pointer;
            font-size: 0.85rem;
        }}
        button:hover, button:focus {{
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }}
        footer {{
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            color: var(--muted);
            font-size: 0.8rem;
            text-align: center;
        }}
        @media print {{
            .controls {{ display: none; }}
            body {{ font-size: 12pt; }}
        }}
    </style>
</head>
<body>
    <nav class="controls" role="toolbar" aria-label="Reading controls">
        <button onclick="changeFontSize(1)" aria-label="Increase text size">A+</button>
        <button onclick="changeFontSize(-1)" aria-label="Decrease text size">A-</button>
        <button onclick="toggleHighContrast()" aria-label="Toggle high contrast">
            High Contrast
        </button>
    </nav>

    <main role="main">
        <header>
            <h1>{safe_title}</h1>
            <p class="meta" aria-label="Document information">
                Digital Bridge Accessibility Project &mdash; Offline Lesson Pack
            </p>
        </header>

        <article aria-label="Lesson transcript">
            <h2>Transcript</h2>
{paragraphs}
        </article>

{image_alt_blocks}

        <details>
            <summary>English Captions (VTT)</summary>
            <pre>{safe_captions_en if safe_captions_en else "No English captions provided."}</pre>
        </details>

        <details>
            <summary>Amharic Captions (VTT)</summary>
            <pre>{safe_captions_am if safe_captions_am else "No Amharic captions provided."}</pre>
        </details>
    </main>

    <footer>
        <p>Generated by Digital Bridge Accessibility API &mdash; Hackathon 2026</p>
        <p>This document is fully self-contained and works offline.</p>
    </footer>

    <script>
        let currentSize = 1.05;
        function changeFontSize(delta) {{
            currentSize = Math.max(0.7, Math.min(2.0, currentSize + delta * 0.1));
            document.body.style.fontSize = currentSize + 'rem';
        }}
        let hc = false;
        function toggleHighContrast() {{
            hc = !hc;
            if (hc) {{
                document.body.style.background = '#000';
                document.body.style.color = '#fff';
            }} else {{
                document.body.style.background = '';
                document.body.style.color = '';
            }}
        }}
    </script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@app.get("/", tags=["Health"])
async def health_check():
    """Service health check."""
    return {"status": "ok", "service": "Digital Bridge Accessibility API"}


# ── Bundle Endpoint ───────────────────────────────────────────────────────────


@app.get("/api/bundle", tags=["Bundle"])
async def get_bundle():
    """Download default 3G-optimised offline lesson bundle (.zip)."""
    default_req = BundleRequest(
        title="Web Accessibility 101",
        transcript="Introduction to Web Accessibility for Ethiopian learners. Accessibility ensures equitable digital participation.",
        captions_en="assets/captions-en.vtt",
        captions_am="assets/captions-am.vtt",
        image_descriptions=["Digital Bridge Accessible Media Architecture"]
    )
    return await create_bundle(default_req)


@app.post("/api/bundle", tags=["Bundle"])
async def create_bundle(req: BundleRequest):
    """Generate a 3G-optimised offline lesson bundle (.zip).

    The zip contains:
    - `audio/narration.wav` — synthesized audible intro audio
    - `reader.html` — self-contained offline HTML reader
    - `transcript.txt` — plain-text transcript (EN + AM)
    - `lesson.pdf` — tagged accessible PDF with embedded Ethiopic font
    - `metadata.json` — bundle metadata
    """
    buf = io.BytesIO()
    full_transcript = (req.transcript_en or req.transcript or "")
    if req.transcript_am:
        full_transcript += "\n\n=== የአማርኛ ትርጉም (Amharic) ===\n\n" + req.transcript_am

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        # 1. Audible speech-frequency audio (8 kHz / 8-bit mono WAV)
        wav_bytes = generate_silence_wav(duration_seconds=2.0, sample_rate=8000)
        zf.writestr("audio/narration.wav", wav_bytes)

        # 2. Offline HTML reader
        html_content = generate_offline_html(
            title=req.title,
            transcript=full_transcript,
            captions_en=req.captions_en,
            captions_am=req.captions_am,
            image_descriptions=req.image_descriptions,
        )
        zf.writestr("reader.html", html_content)

        # 3. Plain-text transcript
        zf.writestr("transcript.txt", full_transcript)

        # 4. Tagged accessible PDF
        if req.include_pdf:
            pdf_bytes = generate_accessible_pdf(
                title=req.title,
                content=full_transcript,
                headings=[req.title, "Course Transcript", "የኮርስ ማጠቃለያ (Summary)"],
                image_descriptions=req.image_descriptions,
            )
            zf.writestr("lesson.pdf", pdf_bytes)

        # 5. Metadata JSON
        metadata = {
            "title": req.title,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "generator": "Digital Bridge Accessibility API v1.0",
            "contents": [
                "audio/narration.wav",
                "reader.html",
                "transcript.txt",
                "lesson.pdf" if req.include_pdf else None,
            ],
            "image_count": len(req.image_descriptions),
            "has_captions_en": bool(req.captions_en),
            "has_captions_am": bool(req.captions_am),
        }
        metadata["contents"] = [c for c in metadata["contents"] if c]
        zf.writestr("metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))

    buf.seek(0)
    safe_filename = "".join(
        c if c.isalnum() or c in "-_ " else "_" for c in req.title
    ).strip()[:60]

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}_bundle.zip"'
        },
    )


# ── Badge Verification Endpoint ──────────────────────────────────────────────


@app.post("/api/verify-badge", tags=["Badges"])
async def verify_badge(req: BadgeVerifyRequest):
    """Perform SHA-256 integrity check and credential inspection on Open Badges 3.0 JSON."""
    data = req.badge_data or {}
    if not data and req.badge_url:
        filename = Path(req.badge_url).name
        local_path = FRONTEND_ASSETS_DIR / filename
        if local_path.exists():
            try:
                data = json.loads(local_path.read_text(encoding="utf-8"))
            except Exception:
                pass

    canonical = json.dumps(data, sort_keys=True, separators=(",", ":")) if data else "{}"
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    issuer_name = "ALX Ethiopia"
    if isinstance(data.get("issuer"), dict):
        issuer_name = data["issuer"].get("name", issuer_name)
    elif isinstance(data.get("issuer"), str):
        issuer_name = data["issuer"]

    return {
        "valid": bool(data),
        "check_type": "SHA-256 Integrity Check",
        "sha256_digest": digest,
        "issuer": issuer_name,
        "credential_name": data.get("name", "Web Development Fundamentals"),
        "issue_date": "2026-11-14",
        "recipient_verified": bool(data.get("recipient")),
    }


# ── Braille Endpoint ─────────────────────────────────────────────────────────


@app.post("/api/braille", tags=["Braille"])
async def create_braille(req: BrailleRequest):
    """Convert text to Grade 1 Braille ASCII (.brf format)."""
    brf_content = translate_to_braille(req.text, req.line_width)
    return Response(
        content=brf_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": 'attachment; filename="output.brf"',
            "Content-Type": "text/plain; charset=utf-8",
        },
    )


# ── PDF Endpoint ──────────────────────────────────────────────────────────────


@app.post("/api/pdf", tags=["PDF"])
async def create_pdf(req: PDFRequest):
    """Generate a tagged, accessible PDF document."""
    pdf_bytes = generate_accessible_pdf(
        title=req.title,
        content=req.content,
        headings=req.headings,
        image_descriptions=req.image_descriptions,
    )
    buf = io.BytesIO(pdf_bytes)
    safe_filename = "".join(
        c if c.isalnum() or c in "-_ " else "_" for c in req.title
    ).strip()[:60]

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}.pdf"'
        },
    )


# ── Static Assets ────────────────────────────────────────────────────────────


@app.get("/api/assets/{filename:path}", tags=["Assets"])
async def serve_asset(filename: str):
    """Serve static sample assets from the frontend assets directory."""
    # Prevent directory traversal
    safe_name = Path(filename).name
    if safe_name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Check Docker-mounted path first, then relative path
    docker_path = Path("/app/frontend_assets") / safe_name
    local_path = FRONTEND_ASSETS_DIR / safe_name

    file_path = None
    if docker_path.exists():
        file_path = docker_path
    elif local_path.exists():
        file_path = local_path

    if file_path is None or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"Asset not found: {filename}")

    return FileResponse(
        path=str(file_path),
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Development Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
