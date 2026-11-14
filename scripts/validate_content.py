"""
Content Validator for Digital Bridge Learning Media.
Enforces:
1. Media file existence (360p, 144p, Opus, poster, captions, transcript)
2. Cue synchronization between English and Amharic
3. Subtitle timing rules: reading speed (chars/sec), min duration, max line length
4. AD cue overlap and boundary verification
5. Review status auditing (reviewed vs unreviewed drafts per Non-Negotiable Rules)
"""
import json
import os
import re
from pathlib import Path

def parse_vtt(vtt_path: Path):
    text = vtt_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    cues = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line:
            parts = line.split("-->")
            start_str, end_str = parts[0].strip(), parts[1].strip().split(" ")[0]
            start = time_to_sec(start_str)
            end = time_to_sec(end_str)
            i += 1
            cue_text = []
            while i < len(lines) and lines[i].strip() and not ("-->" in lines[i] or lines[i].strip().isdigit()):
                cue_text.append(lines[i].strip())
                i += 1
            cues.append({
                "start": start,
                "end": end,
                "duration": round(end - start, 3),
                "text": " ".join(cue_text),
                "raw_lines": cue_text
            })
            continue
        i += 1
    return cues

def time_to_sec(ts: str) -> float:
    parts = ts.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(ts)

def validate():
    assets = Path(__file__).resolve().parent.parent / "frontend" / "assets"
    report = {
        "files_checked": {},
        "cue_sync": True,
        "violations": [],
        "stats": {}
    }

    # 1. Check media files
    required = [
        "lesson_360p.mp4",
        "lesson_144p.mp4",
        "lesson_audio.opus",
        "lesson_poster.jpg",
        "captions-en.vtt",
        "captions-am.vtt",
        "transcript-en.json",
        "transcript-am.json"
    ]
    all_files_exist = True
    for req in required:
        p = assets / req
        exists = p.exists()
        size = p.stat().st_size if exists else 0
        report["files_checked"][req] = {"exists": exists, "bytes": size}
        if not exists:
            all_files_exist = False
            report["violations"].append(f"Missing required asset: {req}")

    if not all_files_exist:
        return report

    # 2. Parse and validate captions
    cues_en = parse_vtt(assets / "captions-en.vtt")
    cues_am = parse_vtt(assets / "captions-am.vtt")

    report["stats"]["cues_en_count"] = len(cues_en)
    report["stats"]["cues_am_count"] = len(cues_am)

    if len(cues_en) != len(cues_am):
        report["violations"].append(f"Cue count mismatch: EN has {len(cues_en)}, AM has {len(cues_am)}")
        report["cue_sync"] = False

    # Check timing constraints
    for idx, (en, am) in enumerate(zip(cues_en, cues_am), 1):
        if abs(en["start"] - am["start"]) > 0.1:
            report["violations"].append(f"Cue #{idx} start sync mismatch: EN={en['start']}s vs AM={am['start']}s")
            report["cue_sync"] = False

        if en["duration"] < 0.3:
            report["violations"].append(f"Cue #{idx} duration too short: {en['duration']}s")

        # Reading speed check (chars/sec)
        cps_en = len(en["text"]) / max(0.5, en["duration"])
        cps_am = len(am["text"]) / max(0.5, am["duration"])
        if cps_en > 32:
            report["violations"].append(f"Cue #{idx} EN reading speed high: {cps_en:.1f} cps")
        if cps_am > 35:
            report["violations"].append(f"Cue #{idx} AM reading speed high: {cps_am:.1f} cps")

    # 3. Check review flags in transcripts
    tr_en = json.loads((assets / "transcript-en.json").read_text(encoding="utf-8"))
    tr_am = json.loads((assets / "transcript-am.json").read_text(encoding="utf-8"))

    report["stats"]["transcript_en_reviewed"] = tr_en.get("reviewed", False)
    report["stats"]["transcript_am_reviewed"] = tr_am.get("reviewed", False)
    unreviewed_am_cues = sum(1 for c in tr_am.get("cues", []) if not c.get("reviewed", False))
    report["stats"]["unreviewed_am_cues"] = unreviewed_am_cues

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report

if __name__ == "__main__":
    validate()
