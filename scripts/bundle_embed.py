"""
Bundle script for Digital Bridge Web Components.
Packages <db-player> and <db-job-card> into a single embeddable bundle: dist/db-player.bundle.js
"""
import os
from pathlib import Path

def build_bundle():
    repo_root = Path(__file__).resolve().parent.parent
    dist_dir = repo_root / "dist"
    dist_dir.mkdir(exist_ok=True)

    player_path = repo_root / "frontend" / "digital-bridge-player.js"
    job_card_path = repo_root / "frontend" / "digital-bridge-job-card.js"

    with open(player_path, "r", encoding="utf-8") as f:
        player_code = f.read()

    with open(job_card_path, "r", encoding="utf-8") as f:
        job_card_code = f.read()

    bundle_header = """/**
 * Digital Bridge Accessible Web Components (<db-player> & <db-job-card>)
 * ALX Digital Bridge Accessibility Hackathon · Track 2: Accessible Learning Media
 *
 * Standalone Embedded Element Bundle.
 * Drop into any web page or LMS via a single <script> tag:
 * <script src="dist/db-player.bundle.js"></script>
 *
 * Provides:
 * - <db-player> with dual WebVTT captions, EthSL PiP window, AD ducking, 3G data saver
 * - <db-job-card> with audio summary, responsive reflow, and Ed25519 VC verification
 * - Composed bubbling CustomEvents: db-player:progress, db-player:complete, db-player:prefs
 *
 * Licence: MIT / Open Source
 */
"""
    bundled_content = f"{bundle_header}\n\n/* ═══ 1. DB PLAYER WEB COMPONENT ═══ */\n{player_code}\n\n/* ═══ 2. DB JOB CARD WEB COMPONENT ═══ */\n{job_card_code}\n"

    output_file = dist_dir / "db-player.bundle.js"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(bundled_content)

    print(f"Bundle built successfully: {output_file} ({len(bundled_content.encode('utf-8'))} bytes)")

if __name__ == "__main__":
    build_bundle()
