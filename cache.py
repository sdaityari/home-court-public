"""
Home Court — shared in-memory TTL cache helper.

app.py used to hand-roll the same `{"data": ..., "fetched_at": ...}` dict
pattern five separate times (the outer /api/scores cache, BCCI fixtures,
BCCI live scores, BCCI results, and the cricketdata.org fallback), each
with its own copy of the "is this still fresh" check. This is that pattern
pulled out once.

Deliberately simple — a single-process in-memory cache, not shared across
gunicorn workers. Fine for this app's scale (a single tablet polling a
single deployed instance); not intended as a general-purpose cache.
"""

import time


class TTLCache:
    """Holds one cached value, refreshed on demand once it's older than
    `ttl_seconds`. `force=True` (the manual refresh button, via `force=1`
    on the request) bypasses freshness and refetches unconditionally.

    Usage:
        cache = TTLCache(ttl_seconds=300)

        def get_data(force=False):
            if cache.is_stale(force):
                cache.set(expensive_fetch())
            return cache.data
    """

    def __init__(self, ttl_seconds):
        self.ttl_seconds = ttl_seconds
        self.data = None
        self.fetched_at = 0

    def is_fresh(self):
        return self.data is not None and (time.time() - self.fetched_at) < self.ttl_seconds

    def is_stale(self, force=False):
        return force or not self.is_fresh()

    def set(self, data):
        self.data = data
        self.fetched_at = time.time()
