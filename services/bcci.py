"""
BCCI (stats.bcci.tv) client — cricket: India men (INDM) and India Women
(INDW). This is the primary source for live scores, upcoming fixtures, and
recent results for both teams. KKR is tracked in CRICKET_TEAMS below but
commented out — see that comment for why and how to re-enable it.

BCCI replaced their old scores.bcci.tv/scores.iplt20.com JSONP feeds with
a much simpler pair of endpoints (confirmed against real sample responses
from both, Aug 2026):

  - https://stats.bcci.tv/match/fixtures/     one flat list (~2000 rows,
    ~5MB) of every match BCCI is tracking across every competition
    worldwide (international AND domestic — Duleep Trophy and India's
    bilateral series both showed up in the same list), each with
    `match_status` of "live" or "forthcoming". This is a REAL forward
    schedule per team (confirmed 38 upcoming India matches spanning
    months), not a rolling few-day window like the feed it replaced —
    a genuine improvement, not just a like-for-like swap.
  - https://stats.bcci.tv/match/live_scores   a small (~8KB), fast
    companion feed: only matches that are currently "live" or very
    recently "complete" (a short rolling window — same reliability gap
    the old feed had for completed matches, which is why India men's
    "recent" still comes from cricketdata.org instead, not this).

Both are plain JSON now — no more JSONP-wrapper stripping needed, and no
more two-hop "competition list → match schedule" discovery dance: every
row already carries `team1_id`/`team2_id`, so matching against a tracked
team is a direct numeric comparison. Confirmed team ids from a real
sample: India (men) = "6", India Women = "2295". KKR's id isn't known yet
(IPL is off-season, so no KKR rows exist in either feed right now to read
it from) — see the CRICKET_TEAMS comment for how to fill it in later.

A third endpoint, https://stats.bcci.tv/match/results, gives completed
matches — paginated (100/page, ~30k rows total across everything BCCI has
ever tracked), sorted most-recent-first, with a clean `winner_team_id`
field (confirmed from a real sample — no more parsing a human-readable
result string to guess win/loss, which the previous approach had to do).
Only page 1 is fetched: since cricket is played somewhere in the world
almost daily, India's most recent match is essentially always within the
most recent 100 global results — confirmed from a real sample, which had
15 India men's and 4 India women's results in page 1 alone. This is now
the primary "recent" source for BOTH India teams — see
bcci_recent_result below. cricketdata.org (services/cricketdata.py) is
kept only as a fallback for India men specifically, in case this feed is
ever unreachable.

fixtures.json is a genuinely large payload for a single-user app to
re-download every poll, so it gets its own long-ish cache
(BCCI_FIXTURES_TTL_SECONDS) independent of live_scores (small, cheap,
cached separately with a shorter TTL) and independent of the outer
/api/scores cache — force=1 (the manual refresh button) bypasses both.
"""

from datetime import datetime, timezone

import requests

from cache import TTLCache
from config import (
    HTTP_HEADERS, HTTP_TIMEOUT, log,
    BCCI_FIXTURES_TTL_SECONDS, BCCI_LIVE_TTL_SECONDS, BCCI_RESULTS_TTL_SECONDS,
)
from services.youtube import cached_highlight_url

# ---------------------------------------------------------------------------
# Team registry — used by every fetch below (the numeric team1_id/team2_id
# match, not name strings, sidesteps the whole "India" vs "India A"
# substring-collision bug class the old name-matching approach had to work
# around).
# ---------------------------------------------------------------------------
CRICKET_TEAMS = {
    # KKR is still disabled for now (commented out, not deleted) — revisit
    # closer to IPL season. Its team_id isn't known yet since IPL is
    # currently off-season (no KKR rows exist in any stats.bcci.tv feed
    # right now to read an id from). Once IPL fixtures are announced, don't
    # just assume this same stats.bcci.tv shape still applies — BCCI has
    # changed its feed infrastructure before (see the module docstring
    # above), so re-confirm team1_id/team2_id are still the right fields
    # and stats.bcci.tv is still the right host before trusting an id
    # pulled from it. Once confirmed, find KKR's id the same way India's
    # were confirmed: pull a live KKR fixture from
    # https://stats.bcci.tv/match/fixtures/ and read its team1_id/team2_id.
    # "KKR":  {"name": "Kolkata Knight Riders", "team_id": "???"},
    "INDM": {"name": "India", "team_id": "6"},
    "INDW": {"name": "India Women", "team_id": "2295"},
}
# ESPN's numeric cricket team ids, kept only as a reference in case BCCI's
# feeds ever need to be abandoned in favor of ESPN cricket data:
#   India (men):   https://www.espn.com/cricket/team/_/id/6/india/
#   India (women): https://www.espn.com/cricket/team/_/id/1812/india-women/
#   KKR:           https://www.espn.com/cricket/team/_/id/335971/kolkata-knight-riders/

BCCI_FIXTURES_URL = "https://stats.bcci.tv/match/fixtures/"
BCCI_LIVE_SCORES_URL = "https://stats.bcci.tv/match/live_scores"
BCCI_RESULTS_URL = "https://stats.bcci.tv/match/results"

_fixtures_cache = TTLCache(BCCI_FIXTURES_TTL_SECONDS)
_live_cache = TTLCache(BCCI_LIVE_TTL_SECONDS)
_results_cache = TTLCache(BCCI_RESULTS_TTL_SECONDS)


def _get_json(url):
    r = requests.get(url, headers=HTTP_HEADERS, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def bcci_fixtures(force=False):
    if _fixtures_cache.is_stale(force):
        try:
            _fixtures_cache.set(_get_json(BCCI_FIXTURES_URL).get("match", []) or [])
        except (requests.RequestException, ValueError) as e:
            log.warning("stats.bcci.tv fixtures fetch failed: %s", e)
            if _fixtures_cache.data is None:
                return []
    return _fixtures_cache.data


def bcci_results(force=False):
    """Page 1 only — see the module docstring above for why that's enough."""
    if _results_cache.is_stale(force):
        try:
            _results_cache.set(_get_json(BCCI_RESULTS_URL).get("match", []) or [])
        except (requests.RequestException, ValueError) as e:
            log.warning("stats.bcci.tv results fetch failed: %s", e)
            if _results_cache.data is None:
                return []
    return _results_cache.data


def bcci_live_scores(force=False):
    if _live_cache.is_stale(force):
        try:
            _live_cache.set(_get_json(BCCI_LIVE_SCORES_URL).get("live_scores", []) or [])
        except (requests.RequestException, ValueError) as e:
            log.warning("stats.bcci.tv live_scores fetch failed: %s", e)
            if _live_cache.data is None:
                return []
    return _live_cache.data


def _bcci_role(m, team_id):
    """If this match row involves team_id, return (our name, opponent name,
    our id, their id) — else None. Matching by the feed's own numeric
    team1_id/team2_id, not name strings, sidesteps the whole "India" vs
    "India A" substring-collision bug class the old name-matching approach
    had to work around."""
    t1, t2 = str(m.get("team1_id")), str(m.get("team2_id"))
    team_id = str(team_id)
    if team_id == t1:
        return m.get("team1_name"), m.get("team2_name"), t1, t2
    if team_id == t2:
        return m.get("team2_name"), m.get("team1_name"), t2, t1
    return None


def _bcci_parse_utc(s):
    """Both feeds use a plain 'YYYY-MM-DD HH:MM:SS' string with no
    timezone marker, confirmed UTC from the field name (start_datetime_utc)."""
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _bcci_format_score(innings, team_id):
    """Build a display score string (e.g. "467 & 111/0 (42.5 ov)") from the
    raw per-innings array, for one team, in innings order. All-out innings
    (wickets == 10) drop the "/10" — reads as plain "467" rather than
    "467/10", matching common cricket-scoreboard convention."""
    team_id = str(team_id)
    parts = []
    for inn in sorted(innings, key=lambda i: int(i.get("innings_number") or 0)):
        if str(inn.get("batting_team_id")) != team_id:
            continue
        runs = inn.get("runs", "0")
        wickets = str(inn.get("wickets", "0"))
        overs = inn.get("overs", "0")
        if wickets == "10":
            parts.append(f"{runs} ({overs} ov)")
        else:
            parts.append(f"{runs}/{wickets} ({overs} ov)")
    return " & ".join(parts) if parts else None


def _bcci_recent_results(results, code, spec):
    """Every completed row in `results` involving this team, from page 1 of
    the results feed — the list is already sorted most-recent-first by the
    feed itself, and this preserves that order rather than stopping at the
    first match. Matches how every other sport in this app works (each
    contributes every completed event it finds, not just the latest one),
    so cricket now participates in the frontend's own shared
    5-item-per-section cap/team-diversity logic (filterGames) instead of
    being pre-truncated to one before it even gets there.

    Skips (rather than guesses) any row where match_end_timestamp doesn't
    parse — a missing/invalid date used to silently fall back to "now" on
    the frontend (parseDate's own fallback for an undefined/unparseable
    value), which is exactly what caused a real bug: a India Women Test
    that actually finished in July was showing up grouped under "TODAY".
    Confirmed root cause: this function was never setting a `when` field
    at all before that fix — live/upcoming both have a start time to read,
    but a completed result needs the match's END time instead, which
    wasn't being pulled from anywhere."""
    team_id = spec["team_id"]
    out = []
    for m in results:
        role = _bcci_role(m, team_id)
        if not role:
            continue
        when_dt = _bcci_parse_utc(m.get("match_end_timestamp"))
        if when_dt is None:
            continue
        _us_name, opponent, us_id, them_id = role
        winner_id = str(m.get("winner_team_id") or "").strip()
        if not winner_id or winner_id == "0":
            result, prefix = "draw", "NR"
        elif winner_id == us_id:
            result, prefix = "win", "W"
        else:
            result, prefix = "loss", "L"
        innings = ((m.get("summary") or {}).get("innings")) or []
        us_score = _bcci_format_score(innings, us_id)
        opp_score = _bcci_format_score(innings, them_id)
        line = f"{prefix} \u00b7 {us_score} \u2013 {opp_score}" if (us_score and opp_score) \
            else f"{prefix} \u00b7 {m.get('result_string') or 'Result'}"
        out.append({
            "team": code, "opponent": opponent, "result": result, "line": line,
            "when": when_dt.isoformat(), "url": None, "competition": m.get("comp_name"),
            "highlight": cached_highlight_url(spec["name"], opponent, when_dt),
        })
    return out


def bcci_cricket_matches(force=False):
    """Live + upcoming + recent for every ACTIVE tracked cricket team (see
    CRICKET_TEAMS — KKR is currently commented out). "Recent" comes from
    the dedicated results feed (bcci_results) — see the module docstring
    above for why that one's reliable where the old approach (inferring
    completion from the schedule feed) wasn't."""
    live, upcoming, recent = [], [], []
    fixtures = bcci_fixtures(force=force)
    live_rows = bcci_live_scores(force=force)
    results = bcci_results(force=force)

    for code, spec in CRICKET_TEAMS.items():
        team_id = spec["team_id"]
        try:
            team_live = []
            for m in live_rows:
                if m.get("match_status") != "live":
                    continue
                role = _bcci_role(m, team_id)
                if not role:
                    continue
                _us_name, opponent, us_id, them_id = role
                innings = ((m.get("summary") or {}).get("innings")) or []
                team_live.append({
                    "team": code,
                    "opponent": opponent,
                    "teamScore": _bcci_format_score(innings, us_id) or "In progress",
                    "oppScore": _bcci_format_score(innings, them_id) or "\u2014",
                    # result_string reads like "Sri Lanka trail India by 495
                    # runs with 8 wickets remaining" — more informative than
                    # live_status_name alone ("stumps"), so lead with it.
                    "status": m.get("result_string") or (m.get("live_status_name") or "Live").title(),
                    "watch": None,  # this feed doesn't include broadcaster info
                    "url": None,    # no confirmed per-match BCCI page URL in the new feed either
                    "competition": m.get("comp_name"),
                })
            live.extend(team_live)

            future = []
            for m in fixtures:
                if m.get("match_status") != "forthcoming":
                    continue
                role = _bcci_role(m, team_id)
                if not role:
                    continue
                _us_name, opponent, _us_id, _them_id = role
                when_dt = _bcci_parse_utc(m.get("start_datetime_utc"))
                if when_dt is None:
                    continue
                future.append((when_dt, opponent, m.get("comp_name")))
            future.sort(key=lambda row: row[0])
            # Every forthcoming match for this team, not just the next one —
            # matches how every other sport in this app works (ESPN's
            # classifyEspnEvents pushes every upcoming event it finds too),
            # so cricket now participates in the frontend's own shared
            # 5-item-per-section cap/team-diversity logic (filterGames)
            # instead of being pre-truncated to one before it even gets
            # there.
            for when_dt, opponent, competition in future:
                # Raw ISO, not a pre-formatted display string — matches the
                # convention every other backend source uses (see
                # services/football_data.py), and is what the frontend's
                # own merge step actually expects to parse. Sending
                # format_when()'s already-human-readable text here instead
                # was a real bug: parseDate() can't parse "Sat · 3:00 PM"
                # as a date, so it silently fell back to "now" for sorting
                # AND day-grouping — the display text looked fine, but the
                # match would group under the wrong day (or "TODAY" no
                # matter its real date). Confirmed same root cause as the
                # missing `when` field in _bcci_recent_results below.
                upcoming.append({"team": code, "opponent": opponent, "when": when_dt.isoformat(),
                                  "url": None, "competition": competition})

            team_recent = _bcci_recent_results(results, code, spec)
            recent.extend(team_recent)

            log.info("stats.bcci.tv %s: live=%d upcoming=%d recent=%d (of %d forthcoming row(s) matched)",
                      code, len(team_live), len(future), len(team_recent), len(future))
        except Exception as e:  # one team's malformed data shouldn't blank the others
            log.warning("stats.bcci.tv fetch/parse failed for %s: %s", code, e)

    return live, upcoming, recent
