"""
Home Court — scoreboard app entry point.

Serves the tablet-facing HTML page and two JSON endpoints:
  - /api/scores     Backend-owned feeds only (cricket + Chelsea) — see
                     scores.py for why, and services/ for each source.
                     MLB/NBA/NFL/EPL/WSL are fetched client-side instead
                     (ESPN blocks server/cloud IPs); see static/js/espn.js.
  - /api/highlight   Resolves a YouTube highlight link for a given
                     team/opponent pair, server-side, so the YouTube API
                     key never reaches the browser. See services/youtube.py.

Also serves sport-specific views at /sport/<sport> — the exact same page
and template, just scoped (client-side, via <body data-sport="...">) to
that one sport's tracked teams/athletes and rivals. See SPORTS below and
static/js/scope.js for how the frontend reads that scope.

Project layout:
    config.py            env vars, constants, logging setup
    cache.py              shared in-memory TTL cache helper
    scores.py              aggregates every backend source for /api/scores
    services/
      bcci.py               BCCI cricket client (live/upcoming/recent)
      cricketdata.py         India-men recent-result fallback
      football_data.py        Chelsea fixtures/results
      youtube.py                highlight link resolver
    templates/index.html   page markup
    static/css/, static/js/  styling + frontend logic (ES modules)

Local run:
    pip install -r requirements.txt
    cp .env.example .env      # then fill in your API keys
    python app.py

Then point a browser at:  http://127.0.0.1:5050

Deploying:
    See DEPLOY.md for PythonAnywhere and Render instructions.
"""

from flask import Flask, abort, jsonify, render_template, request

from config import PORT, DEBUG
from scores import get_scores
from services.youtube import cached_highlight_url

app = Flask(__name__)

# Sport-specific views, in the order/labels shown in the top nav. The slug
# is also what gets written to <body data-sport="..."> and is matched
# against each team/athlete's own `sport` tag in static/js/teams.js — add
# a sport here (and to teams.js) and its own /sport/<slug> view exists
# with no other routing changes needed.
SPORTS = [
    ("baseball", "Baseball"),
    ("basketball", "Basketball"),
    ("football", "Football"),
    ("soccer", "Soccer"),
    ("cricket", "Cricket"),
    ("tennis", "Tennis"),
]
_SPORT_SLUGS = {slug for slug, _ in SPORTS}


@app.route("/")
def index():
    return render_template("index.html", sport=None, sports=SPORTS)


@app.route("/sport/<sport>")
def sport_view(sport):
    if sport not in _SPORT_SLUGS:
        abort(404)
    return render_template("index.html", sport=sport, sports=SPORTS)


@app.route("/api/scores")
def api_scores():
    force = request.args.get("force") == "1"
    return jsonify(get_scores(force=force))


@app.route("/api/highlight")
def api_highlight():
    """Used by the frontend's client-side ESPN fetch to resolve a highlight
    link for a completed game, without exposing YOUTUBE_API_KEY to the
    browser. Cached — see services.youtube.cached_highlight_url. `when` is
    optional (an ISO datetime or any string that module's date parser can
    handle) — it's what disambiguates an older meeting between the same two
    teams from their most recent one."""
    team = request.args.get("team", "").strip()
    opponent = request.args.get("opponent", "").strip()
    when = request.args.get("when", "").strip() or None
    if not team or not opponent:
        return jsonify({"error": "team and opponent query params are required"}), 400
    return jsonify({"url": cached_highlight_url(team, opponent, when)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
