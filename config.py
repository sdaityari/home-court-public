"""
Home Court — configuration and shared setup.

Loads environment variables (.env locally, real env vars on Render/
PythonAnywhere), sets up logging, and exposes the constants every other
module needs (API keys, cache TTLs, the shared HTTP headers/timeout).

Nothing in this module makes network calls — it's pure setup, imported
once at process start by every service module and by app.py.
"""

import os
import logging

from dotenv import load_dotenv

# Load .env from the repo root, regardless of the process's current working
# directory (matters when this module is imported by a WSGI server rather
# than run directly with `python app.py`).
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scoreboard")

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
FOOTBALL_DATA_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "").strip()
FOOTBALL_DATA_TEAM_IDS = {"CHE": 61}
CRICKETDATA_API_KEY = os.getenv("CRICKETDATA_API_KEY", "").strip()

CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", str(15 * 60)))
# A "most recent result" highlight only changes once a team plays its next
# game — cache far longer than the 30-minute score poll so /api/highlight
# doesn't burn through YouTube's daily search quota (100 units/search,
# 10,000/day default).
HIGHLIGHT_CACHE_TTL_SECONDS = int(os.getenv("HIGHLIGHT_CACHE_TTL_SECONDS", str(6 * 60 * 60)))

# BCCI feed TTLs — see services/bcci.py for why each differs.
BCCI_FIXTURES_TTL_SECONDS = int(os.getenv("BCCI_FIXTURES_TTL_SECONDS", str(30 * 60)))  # 30 min — large payload, schedule barely changes minute to minute
BCCI_LIVE_TTL_SECONDS = int(os.getenv("BCCI_LIVE_TTL_SECONDS", str(5 * 60)))  # 5 min — small payload, cheap to refresh more often than the schedule
BCCI_RESULTS_TTL_SECONDS = int(os.getenv("BCCI_RESULTS_TTL_SECONDS", str(15 * 60)))  # 15 min — a finished result won't change, but should show up reasonably promptly after the match ends

# cricketdata.org (CricAPI v1)'s free tier is 100 requests/day TOTAL (not
# hourly), so this gets its own long-TTL cache, independent of both the
# outer /api/scores cache and BCCI's own inner caches — a concluded
# series' result doesn't change until the next series finishes, so there's
# no reason to poll this anywhere near as often as live scores.
CRICKETDATA_TTL_SECONDS = int(os.getenv("CRICKETDATA_TTL_SECONDS", str(6 * 60 * 60)))  # 6h

PORT = int(os.getenv("PORT", "5050"))
DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"

HTTP_TIMEOUT = 8  # seconds, for every outbound request

# ESPN's public API returns 403 Forbidden to requests that don't look like
# they came from a browser (the default python-requests User-Agent gets
# blocked). Sending a normal-looking one fixes it. Used by every service
# module here even though ESPN itself is fetched client-side — BCCI,
# cricketdata.org, and football-data.org all get the same treatment for
# consistency/safety.
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

# This used to only log inside `if __name__ == "__main__":` at the bottom of
# app.py, which runs when you do `python app.py` — but Render (and
# PythonAnywhere) import the app module and serve it via gunicorn/WSGI
# instead, so that block never executes there. A missing key on a real
# deployment produced *no* warning anywhere. Logging at import time means it
# shows up in Render's logs on every boot, regardless of how the app is
# started.
if not YOUTUBE_API_KEY:
    log.warning("YOUTUBE_API_KEY not set — highlight links will fall back to YouTube search "
                "results instead of a direct video.")
if not FOOTBALL_DATA_API_KEY:
    log.warning("FOOTBALL_DATA_API_KEY not set — Chelsea football-data fixtures will be unavailable.")
if not CRICKETDATA_API_KEY:
    log.warning("CRICKETDATA_API_KEY not set — India men's cricketdata.org fallback is unavailable "
                "(harmless as long as BCCI's own results feed is reachable; see bcci_cricket_matches).")
