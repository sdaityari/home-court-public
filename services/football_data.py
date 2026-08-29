"""
football-data.org client — Chelsea Premier League fixtures.

Called from Flask rather than from the browser, intentionally: the API key
therefore stays server-side, and the browser only talks to our same-origin
/api/scores endpoint. The fixture feed can contain both SCHEDULED and TIMED
matches, so we retrieve by date and filter locally.
"""

from datetime import datetime, timezone

import requests

from config import HTTP_HEADERS, HTTP_TIMEOUT, log, FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_TEAM_IDS
from services.youtube import cached_highlight_url


def football_data_matches(force=False):
    """Return Chelsea's upcoming/recent football fixtures from football-data.org.

    Runs in Flask, using FOOTBALL_DATA_API_KEY from the environment, and its
    results are included in /api/scores. `force` is accepted for interface
    symmetry with the other service modules but unused — this source has no
    cache of its own (it's called once per outer /api/scores refresh, which
    already has its own TTL).
    """
    live, upcoming, recent = [], [], []
    if not FOOTBALL_DATA_API_KEY:
        return live, upcoming, recent

    team_id = FOOTBALL_DATA_TEAM_IDS["CHE"]
    headers = {**HTTP_HEADERS, "X-Auth-Token": FOOTBALL_DATA_API_KEY}
    today = datetime.now(timezone.utc).date().isoformat()

    try:
        # One date-scoped request gets the current/future fixtures. Do not
        # filter by status here: football-data can return both SCHEDULED and
        # TIMED fixtures depending on whether kickoff has been finalized.
        upcoming_r = requests.get(
            f"https://api.football-data.org/v4/teams/{team_id}/matches",
            params={"dateFrom": today, "limit": 100},
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        upcoming_r.raise_for_status()

        # A separate small request gives us the most recent completed result.
        finished_r = requests.get(
            f"https://api.football-data.org/v4/teams/{team_id}/matches",
            params={"status": "FINISHED", "limit": 5},
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        finished_r.raise_for_status()

        upcoming_data = upcoming_r.json()
        finished_data = finished_r.json()

        def opponent_of(match):
            home = match.get("homeTeam") or {}
            away = match.get("awayTeam") or {}
            opponent = away if home.get("id") == team_id else home
            return opponent.get("name") or opponent.get("shortName") or "Opponent"

        def competition_of(match):
            # A documented, stable field — "Premier League", "FA Cup",
            # "UEFA Champions League", etc. Worth showing since Chelsea's
            # matches aren't all Premier League despite the static "EPL"
            # league tag.
            return ((match.get("competition") or {}).get("name") or "").strip() or None

        for match in upcoming_data.get("matches", []) or []:
            if match.get("status") not in {"SCHEDULED", "TIMED"}:
                continue
            utc_date = match.get("utcDate")
            if not utc_date:
                continue
            upcoming.append({
                "team": "CHE",
                "opponent": opponent_of(match),
                "when": utc_date,
                "url": None,
                "competition": competition_of(match),
            })

        for match in finished_data.get("matches", []) or []:
            utc_date = match.get("utcDate")
            if not utc_date:
                continue
            home = match.get("homeTeam") or {}
            away = match.get("awayTeam") or {}
            is_home = home.get("id") == team_id
            score = match.get("score") or {}
            full_time = score.get("fullTime") or {}
            us = full_time.get("home" if is_home else "away")
            them = full_time.get("away" if is_home else "home")
            if us is None or them is None:
                continue
            if us > them:
                result, prefix = "win", "W"
            elif us < them:
                result, prefix = "loss", "L"
            else:
                result, prefix = "draw", "D"
            recent.append({
                "team": "CHE",
                "opponent": opponent_of(match),
                "when": utc_date,
                "result": result,
                "line": f"{prefix} {us}\u2013{them}",
                "url": None,
                "competition": competition_of(match),
                "highlight": cached_highlight_url("Chelsea", opponent_of(match), utc_date),
            })

        upcoming.sort(key=lambda g: g["when"])
        recent.sort(key=lambda g: g["when"], reverse=True)

        # The UI only needs Chelsea's next fixture and most recent result from
        # this supplementary source; ESPN can still supply richer details
        # (broadcast/link) whenever it has the same event.
        upcoming = upcoming[:1]
        recent = recent[:1]
        log.info("football-data CHE: %d upcoming fixture(s), %d recent result(s)",
                 len(upcoming), len(recent))
    except (requests.RequestException, ValueError) as e:
        log.warning("football-data Chelsea fetch failed: %s", e)

    return live, upcoming, recent
