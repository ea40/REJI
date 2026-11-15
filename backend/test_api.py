import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from main import app

client = TestClient(app)

def test_health_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Digital Bridge Accessibility API"

def test_get_bundle():
    response = client.get("/api/bundle")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert len(response.content) > 0

def test_post_bundle():
    payload = {
        "title": "Introduction to Accessible Web Development",
        "transcript": "Hello learners, welcome to this lesson.",
        "include_audio": True,
        "include_pdf": True,
        "image_descriptions": ["Diagram of accessible player controls"]
    }
    response = client.post("/api/bundle", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert len(response.content) > 0

def test_braille_conversion():
    payload = {
        "text": "Hello Digital Bridge",
        "line_width": 40
    }
    response = client.post("/api/braille", json=payload)
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert len(response.text) > 0

def test_pdf_generation():
    payload = {
        "title": "Digital Bridge Lesson Summary",
        "content": "This is accessible course content formatted for Ethiopian learners.",
        "headings": ["Section 1: Overview"],
        "image_descriptions": ["Hero image showing EthSL signer"]
    }
    response = client.post("/api/pdf", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0

def test_verify_genuine_open_badge_vc():
    """Verify genuine Open Badges 3.0 / W3C VC with authentic Ed25519 signature."""
    badge_path = backend_dir.parent / "frontend" / "assets" / "sample-badge.json"
    import json
    badge_data = json.loads(badge_path.read_text(encoding="utf-8"))

    payload = {"badge_data": badge_data}
    response = client.post("/api/verify-badge", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["issuer"] == "ALX Ethiopia"
    assert data["recipient_name"] == "Abebe Kebede"
    assert data["revocation_status"] == "active"
    assert "Ed25519" in data["check_type"]


def test_verify_badge_via_asset_url():
    """Verify badge loading and cryptographic check via relative asset URL."""
    payload = {"badge_url": "assets/sample-badge.json"}
    response = client.post("/api/verify-badge", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["recipient_name"] == "Abebe Kebede"


def test_verify_tampered_recipient_fails():
    """Tampering with recipient name must fail cryptographic signature verification."""
    badge_path = backend_dir.parent / "frontend" / "assets" / "sample-badge.json"
    import json
    badge_data = json.loads(badge_path.read_text(encoding="utf-8"))

    # Maliciously modify recipient name
    badge_data["credentialSubject"]["name"] = "Impostor Candidate"

    response = client.post("/api/verify-badge", json={"badge_data": badge_data})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "signature verification failed" in data["reason"].lower()


def test_verify_tampered_achievement_fails():
    """Tampering with credential achievement or description must fail signature."""
    badge_path = backend_dir.parent / "frontend" / "assets" / "sample-badge.json"
    import json
    badge_data = json.loads(badge_path.read_text(encoding="utf-8"))

    # Maliciously modify achievement name
    badge_data["credentialSubject"]["achievement"]["name"] = "Senior Web Architect (Forged)"

    response = client.post("/api/verify-badge", json={"badge_data": badge_data})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "signature verification failed" in data["reason"].lower()


def test_verify_expired_badge_fails():
    """Expired credentials must return valid: false."""
    badge_path = backend_dir.parent / "frontend" / "assets" / "sample-badge.json"
    import json
    badge_data = json.loads(badge_path.read_text(encoding="utf-8"))

    # Set expiration date in the past
    badge_data["expirationDate"] = "2020-01-01T00:00:00Z"

    response = client.post("/api/verify-badge", json={"badge_data": badge_data})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "expired" in data["reason"].lower()


def test_verify_revoked_badge_id_fails():
    """Revoked credentials in revocation list must return valid: false."""
    badge_path = backend_dir.parent / "frontend" / "assets" / "sample-badge.json"
    import json
    badge_data = json.loads(badge_path.read_text(encoding="utf-8"))

    # Use revoked credential ID
    badge_data["id"] = "urn:uuid:revoked-0000-0000-0000-000000000000"

    response = client.post("/api/verify-badge", json={"badge_data": badge_data})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "revoked" in data["reason"].lower()


def test_verify_unsigned_badge_fails():
    """Unsigned badge without proof object must return valid: false."""
    payload = {
        "badge_data": {
            "@context": "https://www.w3.org/ns/credentials/v2",
            "type": ["VerifiableCredential", "OpenBadgeCredential"],
            "name": "Unsigned Certificate",
            "issuer": {"name": "ALX Ethiopia"}
        }
    }
    response = client.post("/api/verify-badge", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "proof object missing" in data["reason"].lower()

def test_translate_endpoint():
    payload = {
        "text": "Welcome to the web browser and server lesson",
        "source_lang": "en",
        "target_lang": "am"
    }
    response = client.post("/api/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "translated_text" in data
    assert data["target_lang"] == "am"
    assert data["reviewed"] is False  # Integrity rule: machine drafts marked unreviewed
    assert "አሳሽ" in data["translated_text"] or "አገልጋይ" in data["translated_text"]


def test_get_lesson_v1():
    response = client.get("/api/v1/lessons/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "1"
    assert "What is The Web" in data["title"]
    assert "sources" in data
    assert "video_360p" in data["sources"]
    assert "captions" in data
    assert len(data["captions"]) >= 2
    assert data["captions"][0]["lang"] == "en"
    assert data["captions"][1]["lang"] == "am"
    assert data["captions"][1]["reviewed"] is False  # Integrity rule


def test_get_lesson_v1_not_found():
    response = client.get("/api/v1/lessons/nonexistent-999")
    assert response.status_code == 404


def test_get_lesson_transcript_v1_en():
    response = client.get("/api/v1/lessons/1/transcript?lang=en")
    assert response.status_code == 200
    data = response.json()
    assert data["lesson_id"] == "1"
    assert data["lang"] == "en"
    assert data["reviewed"] is True
    assert "data" in data
    assert len(data["data"]) > 0


def test_get_lesson_transcript_v1_am():
    response = client.get("/api/v1/lessons/1/transcript?lang=am")
    assert response.status_code == 200
    data = response.json()
    assert data["lesson_id"] == "1"
    assert data["lang"] == "am"
    assert data["reviewed"] is False  # Unreviewed draft rule
    assert "data" in data


def test_get_lesson_transcript_v1_invalid_lang():
    response = client.get("/api/v1/lessons/1/transcript?lang=xyz")
    assert response.status_code == 400


def test_get_lesson_offline_pack_v1():
    response = client.get("/api/v1/lessons/1/offline-pack")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert len(response.content) > 0


def test_submit_lesson_captions_v1():
    vtt = """WEBVTT

1
00:00:01.000 --> 00:00:04.000
የድር አሰሳ ምንድን ነው?

2
00:00:04.500 --> 00:00:08.000
መረቡን ለመረዳት መሰረታዊ ፅንሰ ሃሳብ።
"""
    payload = {
        "vtt_content": vtt,
        "lang": "am",
        "contributor": "Ethiopian Accessibility Collective"
    }
    response = client.post("/api/v1/lessons/1/captions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["cues_received"] == 2
    assert data["reviewed"] is False


def test_submit_lesson_captions_v1_invalid_vtt():
    payload = {
        "vtt_content": "This is not a webvtt file at all",
        "lang": "en"
    }
    response = client.post("/api/v1/lessons/1/captions", json=payload)
    assert response.status_code == 400
