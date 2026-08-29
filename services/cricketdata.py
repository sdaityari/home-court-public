"""
cricketdata.org (CricAPI v1) client — India men's recent-result FALLBACK.

BCCI's own results feed (services/bcci.py) is now the primary source for
every active team's "recent" — it has a clean winner_team_id field,
confirmed from a real sample. This cricketdata.org path only gets called
when BCCI's results feed comes back with nothing for India men specifically
(see scores.build_scores_payload) — a second, independent source as a
safety net in case BCCI's feed is ever unreachable. Not consulted for
India Women; if BCCI's feed is down, INDW's "recent" is just empty for
that cycle.
"""

from datetime import datetime, timezone

import requests

from cache import TTLCache
from config import HTTP_HEADERS, HTTP_TIMEOUT, log, CRICKETDATA_API_KEY, CRICKETDATA_TTL_SECONDS
from services.youtube import cached_highlight_url

_recent_cache = TTLCache(CRICKETDATA_TTL_SECONDS)


def _get_all(endpoint, max_pages=6):
    """Paginated cricapi v1 call. A single page tops out around 25 rows —
    info.totalRows tells you the real count. Loops until every row is
    fetched or max_pages is hit, whichever comes first — the cap exists so
    one call here can't blow through the 100/day quota by itself if
    totalRows is ever huge."""
    all_data = []
    offset = 0
    for page in range(max_pages):
        r = requests.get(
            f"https://api.cricapi.com/v1/{endpoint}",
            params={"apikey": CRICKETDATA_API_KEY, "offset": offset},
            headers=HTTP_HEADERS,
            timeout=HTTP_TIMEOUT,
        )
        r.raise_for_status()
        body = r.json()
        if body.get("status") != "success":
            log.warning("cricketdata.org %s returned failure: %s", endpoint, body.get("reason", "(no reason given)"))
            break
        data = body.get("data", []) or []
        all_data.extend(data)
        info = body.get("info", {})
        total_rows = info.get("totalRows", len(data))
        offset += len(data)
        if not data or offset >= total_rows:
            break
    return all_data


def _parse_datetime(gmt_str):
    try:
        return datetime.strptime(gmt_str, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def cricketdata_recent_india_result(force=False):
    """India men's most recent CONCLUDED match, from cricketdata.org. Exact
    team-name equality against "India" (cricapi's `teams` field is a pair
    of full name strings, e.g. ["India", "Sri Lanka"] — not a substring/
    fuzzy match, so "India A"/"India Women"/etc are naturally excluded as
    different strings entirely, no separate exclusion list needed here)."""
    if not CRICKETDATA_API_KEY:
        return None

    if not _recent_cache.is_stale(force):
        return _recent_cache.data

    try:
        # currentMatches covers live + recently-finished; matches covers a
        # broader schedule window. Checking both maximizes the chance of
        # catching the last concluded series even if it finished a little
        # outside currentMatches' own recency window.
        rows = _get_all("currentMatches") + _get_all("matches")
    except requests.RequestException as e:
        log.warning("cricketdata.org fetch failed: %s", e)
        return _recent_cache.data  # serve stale data rather than nothing, if we have any

    candidates = []
    for m in rows:
        teams = m.get("teams") or []
        if not any((t or "").strip().lower() == "india" for t in teams):
            continue
        if not m.get("matchEnded"):
            continue
        dt = _parse_datetime(m.get("dateTimeGMT"))
        if dt is None:
            continue
        opponent = next((t for t in teams if (t or "").strip().lower() != "india"), "Opponent")
        candidates.append((dt, m, opponent))

    if not candidates:
        _recent_cache.set(None)
        return None

    candidates.sort(key=lambda c: c[0], reverse=True)
    _dt, m, opponent = candidates[0]

    # cricapi v1 doesn't give a clean winner-id field on this tier — the
    # best available signal is the human-readable `status` string, e.g.
    # "India won by 5 wickets". Fragile (depends on exact wording), but
    # it's what's actually available here.
    status_text = (m.get("status") or "").strip()
    status_l = status_text.lower()
    if "india" in status_l and "won" in status_l:
        result, prefix = "win", "W"
    elif "won" in status_l:
        result, prefix = "loss", "L"
    else:
        result, prefix = "draw", "NR"

    # cricapi's `name` is a full descriptive string, e.g. "India tour of
    # Zimbabwe, 2026 - Only T20I" — the part before " - " reads like a
    # series/tour name (comparable to a tournament name), the part after is
    # a specific match label (e.g. "1st Test") we already show via `line`.
    raw_name = (m.get("name") or "").strip()
    competition = raw_name.split(" - ")[0].strip() if raw_name else None

    result_obj = {
        "team": "INDM",
        "opponent": opponent,
        "result": result,
        "line": f"{prefix} \u00b7 {status_text or 'Result'}",
        "url": None,
        "competition": competition,
        "highlight": cached_highlight_url("India", opponent, _dt),
    }
    _recent_cache.set(result_obj)
    log.info("cricketdata.org INDM: last concluded match vs %s \u2192 %s", opponent, result)
    return result_obj
