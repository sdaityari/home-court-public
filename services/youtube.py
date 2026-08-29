"""
YouTube highlight lookup — resolves a YouTube highlight link for a given
team/opponent pair. Used by every other service module here (bcci,
cricketdata, football_data) to attach a `highlight` link to each "recent"
result, and by the /api/highlight route directly for ESPN-sourced results
(MLB/NBA/EPL/WSL), which are fetched client-side and so need a server-side
detour just for this lookup — see app.py's api_highlight route.

Results are cached in memory for HIGHLIGHT_CACHE_TTL_SECONDS to avoid
burning through YouTube's daily quota on every poll.
"""

import time
from datetime import datetime
from urllib.parse import quote_plus

import requests

from config import HTTP_HEADERS, HTTP_TIMEOUT, log, YOUTUBE_API_KEY, HIGHLIGHT_CACHE_TTL_SECONDS


def _format_date_for_search(value):
    """Best-effort 'Aug 22, 2026' formatting for search-query disambiguation
    — accepts a datetime, an ISO string, or None; never raises. A highlight
    link with no date is still useful, so any parse failure just omits it
    rather than blocking the link entirely."""
    dt = value
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    if not isinstance(dt, datetime):
        return None
    return dt.strftime("%b %-d, %Y")


def youtube_highlight_url(team_name, opponent_name, when=None):
    # The date matters for both paths below, not just the no-API-key
    # fallback: "Team vs Opponent highlights" alone also isn't specific
    # enough for the real YouTube Data API search to reliably surface an
    # OLDER meeting between the same two teams rather than their most
    # recent one — same underlying ambiguity, same fix.
    date_str = _format_date_for_search(when)
    query = f"{team_name} vs {opponent_name}" + (f" {date_str}" if date_str else "") + " highlights"
    if not YOUTUBE_API_KEY:
        # Graceful fallback: a search-results link always works, no key needed.
        return f"https://www.youtube.com/results?search_query={quote_plus(query)}"

    try:
        r = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "order": "relevance",
                "maxResults": 1,
                "key": YOUTUBE_API_KEY,
            },
            headers=HTTP_HEADERS,
            timeout=HTTP_TIMEOUT,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        if items:
            video_id = items[0]["id"]["videoId"]
            return f"https://www.youtube.com/watch?v={video_id}"
    except (requests.RequestException, KeyError) as e:
        log.warning("YouTube search failed for '%s': %s", query, e)

    return f"https://www.youtube.com/results?search_query={quote_plus(query)}"


_highlight_cache = {}  # (team_name, opponent_name, date_str) -> (url, cached_at)


def cached_highlight_url(team_name, opponent_name, when=None):
    date_str = _format_date_for_search(when)
    key = (team_name, opponent_name, date_str)
    now = time.time()
    cached = _highlight_cache.get(key)
    if cached and (now - cached[1]) < HIGHLIGHT_CACHE_TTL_SECONDS:
        return cached[0]
    url = youtube_highlight_url(team_name, opponent_name, when)
    _highlight_cache[key] = (url, now)
    return url
