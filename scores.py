"""
Home Court — top-level score aggregation.

Combines every backend-owned data source (BCCI cricket, its cricketdata.org
fallback, football-data.org Chelsea) into the single payload /api/scores
serves, and owns the outer response cache.

MLB/NBA/EPL/WSL are NOT fetched here — ESPN's public API blocks requests
from cloud/datacenter IPs (confirmed on this app's Render deployment), so
the frontend fetches ESPN directly from the tablet's own browser instead,
where the request comes from a normal residential IP. See the ESPN_TEAMS
block in static/js/teams.js for that logic. football-data.org and
cricketdata.org both require an API token, so — unlike ESPN — they're
fetched here in Flask rather than from the browser.
"""

from datetime import datetime

from cache import TTLCache
from config import CACHE_TTL_SECONDS
from services.bcci import bcci_cricket_matches
from services.cricketdata import cricketdata_recent_india_result
from services.football_data import football_data_matches

_cache = TTLCache(CACHE_TTL_SECONDS)


def build_scores_payload(force=False):
    """Return backend-owned feeds: BCCI cricket (+ cricketdata.org as an
    India-men-only fallback) + football-data Chelsea.
    """
    cricket_live, cricket_upcoming, cricket_recent_bcci = bcci_cricket_matches(force=force)

    # BCCI's results feed (bcci_cricket_matches) is the primary "recent"
    # source for every active cricket team now that it has a clean
    # winner_team_id field — see services/bcci.py's BCCI_RESULTS_URL
    # comment for why that's reliable where the old approach wasn't.
    # cricketdata.org is kept only as a fallback for India men
    # specifically, in case BCCI's results feed had NOTHING for them at
    # all — it's never consulted for India Women, which simply has no
    # results some cycles if BCCI's feed is down. cricket_recent_bcci can
    # now hold several results per team (not just the latest one — see
    # services.bcci._bcci_recent_results), so this checks for the team's
    # PRESENCE rather than building a team-keyed dict, which would have
    # silently collapsed multiple India-men results down to just one.
    cricket_recent = list(cricket_recent_bcci)
    if not any(r["team"] == "INDM" for r in cricket_recent_bcci):
        cricketdata_recent = cricketdata_recent_india_result(force=force)
        if cricketdata_recent:
            cricket_recent.append(cricketdata_recent)

    football_live, football_upcoming, football_recent = football_data_matches(force=force)

    return {
        "updated_at": datetime.now().astimezone().isoformat(),
        "live": [*cricket_live, *football_live],
        "upcoming": [*cricket_upcoming, *football_upcoming],
        "recent": [*cricket_recent, *football_recent],
    }


def get_scores(force=False):
    """The cached, route-facing entry point — refetches only when the
    outer cache is stale or `force` (the manual refresh button) is set."""
    if _cache.is_stale(force):
        from config import log
        log.info("Refreshing scores (force=%s)", force)
        _cache.set(build_scores_payload(force=force))
    return _cache.data
