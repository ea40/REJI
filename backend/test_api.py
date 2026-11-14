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

def test_verify_badge_integrity():
    payload = {
        "badge_data": {
            "@context": "https://w3id.org/openbadges/v2",
            "type": "BadgeClass",
            "name": "Accessible Media Specialist",
            "issuer": {
                "name": "ALX Ethiopia"
            }
        }
    }
    response = client.post("/api/verify-badge", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert "sha256_digest" in data
