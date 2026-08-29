# Deploying Home Court

Home Court can run on Render or PythonAnywhere. Render is simpler (no
virtualenv/WSGI setup, no free-tier outbound whitelist to fight) and is the
recommended option; PythonAnywhere instructions are kept below for anyone
already using it.

## Render

1. **Push the project to GitHub** (or GitLab), keeping the folder structure:
   ```
   ├── app.py
   ├── config.py
   ├── cache.py
   ├── scores.py
   ├── services/
   │   ├── bcci.py
   │   ├── cricketdata.py
   │   ├── football_data.py
   │   └── youtube.py
   ├── requirements.txt
   ├── templates/
   │   └── index.html
   └── static/
       ├── css/
       │   └── styles.css
       └── js/
           ├── teams.js
           ├── utils.js
           ├── tennis.js
           ├── espn.js
           ├── filters.js
           ├── render.js
           └── main.js
   ```
2. **Render Dashboard → New → Web Service**, connect the repo.
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
   - Root Directory: blank (leave default) if `app.py` is at the repo root.
3. **Add environment variables** under the service's **Environment** tab —
   see the table in `README.md` for the full list (`YOUTUBE_API_KEY`,
   `FOOTBALL_DATA_API_KEY`, `CRICKETDATA_API_KEY`, and the optional cache-TTL
   overrides). Render sets `$PORT` itself; you don't need to add it.
4. **Deploy.** Render builds and gives you a public URL
   (`https://your-app.onrender.com`).
5. **Verify:**
   - Visit `/api/scores` directly — you should get JSON with
     `live`/`upcoming`/`recent` arrays (cricket + Chelsea, if
     `FOOTBALL_DATA_API_KEY` is set).
   - Open the deployed page and check DevTools → Network for `200`s from
     `site.api.espn.com` — that confirms MLB/NBA/EPL/WSL/NWSL are working
     client-side.
   - Check the **Logs** tab for warnings — every failed fetch logs which
     host it couldn't reach.

Render has **no outbound whitelist** to fight (unlike PythonAnywhere's free
tier, section 5 below) — every external host this app calls
(`stats.bcci.tv`, `api.cricapi.com`, `www.googleapis.com`,
`api.football-data.org`) is reachable from a Render Web Service without
any extra configuration. The one exception on *either* host is ESPN
itself blocking server-side requests entirely — see section 8, which is
why MLB/NBA/EPL/WSL/NWSL are fetched from the browser instead.

For team-config changes (which teams/players are tracked, and the
selectable competitors panel), see `README.md` — that's the single place
those instructions live.

---

## PythonAnywhere

## 1. Upload the project

On the PythonAnywhere **Files** tab, create a folder (e.g. `home-court`) and
upload these files, keeping the folder structure:

```
home-court/
├── app.py
├── config.py
├── cache.py
├── scores.py
├── services/
│   ├── bcci.py
│   ├── cricketdata.py
│   ├── football_data.py
│   └── youtube.py
├── requirements.txt
├── .env.example
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        ├── teams.js
        ├── utils.js
        ├── tennis.js
        ├── espn.js
        ├── filters.js
        ├── render.js
        └── main.js
```

The easiest way: zip the folder locally and upload the zip, then unzip it in
a Bash console:
```
unzip home-court.zip
```

## 2. Create a virtualenv and install dependencies

In a PythonAnywhere **Bash console**:
```bash
cd ~/home-court
mkvirtualenv --python=python3.10 home-court-venv
pip install -r requirements.txt
```

## 3. Set your API keys

Don't rely on `.env` under the web app — PythonAnywhere's WSGI process
doesn't reliably run from your project directory, so `python-dotenv` may not
find it. Set the keys as real environment variables instead:

Go to the **Web** tab → your app → **Environment variables** section, and add:

| Name                    | Value                  |
|--------------------------|------------------------|
| `YOUTUBE_API_KEY`        | *(your YouTube Data API v3 key)* |
| `FOOTBALL_DATA_API_KEY`  | *(your football-data.org API token)* |
| `CRICKETDATA_API_KEY`    | *(your cricketdata.org / CricAPI v1 key)* |
| `CACHE_TTL_SECONDS`      | `180` *(optional)*     |
| `BCCI_FIXTURES_TTL_SECONDS` | *(optional — see section 12, default 30 min)* |
| `BCCI_LIVE_TTL_SECONDS`  | *(optional — see section 12, default 5 min)* |
| `BCCI_RESULTS_TTL_SECONDS` | *(optional — see section 12, default 15 min)* |

(If your PythonAnywhere plan doesn't show that section, keep the `.env` file
in `~/home-court/.env` — config.py loads it relative to its own file location,
so it will still work as a fallback.)

### Chelsea / football-data.org

Chelsea's Premier League upcoming fixtures are fetched by Flask from
football-data.org and returned through the same-origin `/api/scores` endpoint.
The API token is **not** included in the frontend and must be supplied
as `FOOTBALL_DATA_API_KEY`. This avoids browser CORS/authentication issues and
keeps the token out of the page source. The backend requests Chelsea team ID
`61`, retrieves matches from today's date onward, and accepts both `SCHEDULED`
and `TIMED` statuses.

After setting the variable, reload the web app and check:

```text
https://yourusername.pythonanywhere.com/api/scores
```

The JSON should contain Chelsea's next fixture in the `upcoming` array.

### India men's cricket / cricketdata.org

India men's most recent CONCLUDED series result is fetched by Flask from
cricketdata.org (CricAPI v1) and merged into the same `/api/scores`
response, alongside BCCI's live score and upcoming schedule for the same
team. It needs `CRICKETDATA_API_KEY` set — without it, the app falls back
to BCCI's own "recent" data for India men, which is the thing this was
added to work around (see section 12 for why that's unreliable). See
section 12 for the full picture, including why KKR and India Women are
currently commented out entirely rather than also getting a
cricketdata.org fallback.

## 4. Create the web app

1. **Web** tab → **Add a new web app** → choose **Manual configuration** →
   pick the same Python version as your virtualenv.
2. Under **Virtualenv**, point it at `/home/yourusername/.virtualenvs/home-court-venv`.
3. Under **Code**, set:
   - Source code: `/home/yourusername/home-court`
   - Working directory: `/home/yourusername/home-court`
4. Click the **WSGI configuration file** link and replace its contents with:

```python
import sys

project_home = '/home/yourusername/home-court'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from app import app as application
```

(Replace `yourusername` with your actual PythonAnywhere username, in both
the Web tab paths and the WSGI file.)

5. Click the green **Reload** button on the Web tab.
6. Visit `https://yourusername.pythonanywhere.com` — you should see the
   scoreboard.

## 5. Important: free-tier outbound internet is whitelisted

PythonAnywhere **free accounts can only make outbound requests to a
whitelist of approved domains** — paid plans (Hacker tier and up) get
unrestricted internet access. This app calls these external hosts from the
backend:

- `stats.bcci.tv` (cricket: India men's + women's — live, upcoming, and
  recent results — see section 12)
- `api.cricapi.com` (cricket: India men's recent-result fallback, via
  cricketdata.org)
- `www.googleapis.com` (YouTube highlight lookup)
- `api.football-data.org` (Chelsea fixtures)

`site.api.espn.com` does **not** need to be on this whitelist — it's called
directly from the tablet's browser (a normal residential IP) for every
non-cricket sport, not from the backend. See section 9.

If you're on the free tier and any of these aren't already whitelisted,
requests to them will fail (you'll see `live`/`upcoming`/`recent` come back
empty, and warnings in the PythonAnywhere error log). Two options:

- Request the domains be added at
  <https://help.pythonanywhere.com/pages/RequestingAllowlistAdditions/>
  (link the API docs for each when asking), or
- Upgrade to a paid plan for unrestricted outbound access.

## 6. Verifying it's working

- **Web** tab → **Log files** → check the *error log* if the page loads but
  shows no data — the backend logs a warning line for every failed fetch,
  naming the exact host it couldn't reach.
- Hit `https://yourusername.pythonanywhere.com/api/scores` directly in a
  browser to see the raw JSON the frontend is consuming.
- The manual **Refresh** button on the page calls `/api/scores?force=1`,
  bypassing the 3-minute cache — use it while testing so you're not waiting
  on `CACHE_TTL_SECONDS`.

## 8. About the ESPN 403 issue and how it's handled now

ESPN's public schedule API (`site.api.espn.com`) blocks requests from
cloud/datacenter IP ranges — this showed up as `403 Forbidden` on both
PythonAnywhere and Render, regardless of headers. It's not a whitelist thing
(unlike PythonAnywhere's free-tier restriction) — it's ESPN's own CDN
rejecting requests that don't look like they came from an ordinary consumer
network.

To work around it, **MLB/NBA/EPL/WSL are fetched directly from the tablet's
browser**, not from the Flask backend — a home network has a normal
residential IP, which isn't part of the blocked ranges. Chelsea/Chelsea
Women additionally cross-reference football-data.org client-side too — see
section 13. A small `/api/highlight` endpoint resolves YouTube highlight
links server-side so the YouTube key never reaches the browser, and caches
results for 6 hours to stay well under YouTube's daily search quota.

Cricket (India men `INDM` and India Women `INDW` — both active, see
section 12) is fetched from the *backend*, via two sources: BCCI's own feed
for live/upcoming, plus cricketdata.org as a fallback for India men's last
concluded result. See section 12 for the full picture of what's confirmed
working.

**How to verify MLB/NBA/EPL/WSL are working**: open the deployed page, open
the browser's DevTools → Network tab, and look for requests to
`site.api.espn.com` — you should see one to each team's `.../schedule`
endpoint. A `200` response means it's working. If you instead see the
request blocked with a CORS error in the console (rather than a 403), that
means ESPN doesn't allow browser-origin requests either — in that case the
affected section(s) will just stay empty, and the fix would be switching
that sport to a documented sports API instead (as already done for Chelsea
via football-data.org, section 13).

## 9. A couple of things worth knowing about the current team config

- MLB/NBA/EPL/WSL/NWSL team config lives in a single place now:
  `ESPN_TEAMS`/`TEAMS` in `static/js/teams.js`. (An older duplicate copy of
  `ESPN_TEAMS` used to also live in `app.py` from before the fetch moved
  client-side — it was dead code and has been removed, so there's no
  second copy to keep in sync anymore.)
- `ESPN_TEAMS.CHEW` (Chelsea Women / WSL) uses the same numeric ESPN team ID
  as the men's Chelsea entry (`363`) — an unverified placeholder (this
  sandbox couldn't reach espn.com to confirm it). Check it against
  `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.w.1/teams`
  once you have real internet access, and update the `team` value if it's
  wrong.
- If any ESPN team ever 404s, the same `/teams` listing URL (swap in the
  right sport/league) will show you the correct ID or abbreviation to use.
- `CRICKET_TEAMS` (in `services/bcci.py`) matches by numeric `team_id` against BCCI's
  own `team1_id`/`team2_id` fields, not by name — see section 12 for how
  each id was confirmed.
- **India men (`INDM`) and India Women (`INDW`) are both active.** Only
  **KKR** is currently commented out in `CRICKET_TEAMS` (not deleted) —
  see section 12 for why, and for what to re-verify (not just assume)
  before uncommenting it once IPL fixtures are announced.

## 10. Troubleshooting: cricket section stays empty

Cricket is fetched from the backend (`/api/scores`), via BCCI's
stats.bcci.tv feeds primarily, with cricketdata.org as an India-men-only
fallback (see section 12) — so start with the backend logs, not the
browser console. Look for lines like `stats.bcci.tv INDM: live=1
upcoming=True recent=True (of 37 forthcoming row(s) matched)` (Render:
**Logs** tab; PythonAnywhere: **Web** tab → error log; local: the terminal
running `python app.py`):

- `stats.bcci.tv fixtures fetch failed: ...` / `stats.bcci.tv live_scores
  fetch failed: ...` / `stats.bcci.tv results fetch failed: ...` → the
  outbound request to `stats.bcci.tv` itself failed (network whitelist on
  PythonAnywhere free tier — see section 5 — or the host blocking this
  specific network the way ESPN does, though nothing so far suggests BCCI
  does that).
- `live=0 upcoming=False recent=False` for a team → either that team
  genuinely has nothing live/scheduled/recent matching `team_id` right now
  (check the raw feed yourself: `curl -s
  https://stats.bcci.tv/match/fixtures/ | head -c 500`), or BCCI has
  changed that team's id again (currently `"6"` for India men, `"2295"`
  for India Women, in `CRICKET_TEAMS` — see section 12 for how these were
  confirmed).
- `recent=False` specifically, with live/upcoming fine → check
  `cricketdata.org INDM: last concluded match vs ... → ...` right after it
  in the logs (India men only) to see if the fallback kicked in and
  worked; for India Women there's no fallback, so `recent=False` there
  just means BCCI's results feed didn't have a match for them in its most
  recent page (rare — see section 12).
- `CRICKETDATA_API_KEY not set` warning at boot → harmless as long as
  BCCI's results feed is working; only matters if that feed goes down for
  India men specifically. Set the key (section 3) to close the gap anyway.
- `cricketdata.org ... returned failure: ...` → cricapi's own error
  reason is logged verbatim (e.g. an invalid key, or the 100/day free-tier
  quota exhausted — it resets daily, no action needed beyond waiting).
- Everything looks fine in the logs but the *page* still shows nothing →
  hit `/api/scores?force=1` directly in a browser and check the JSON; if
  that has data but the page doesn't, it's a frontend rendering issue, not
  a fetch issue.

## 11. Troubleshooting: some ESPN teams show nothing

Open the browser console (F12 → Console) and look for lines like `ESPN NYK:
3 raw events (teamId=...) → live=0 upcoming=0 recent=0`. This tells you
exactly what ESPN returned and how it was classified:

- **0 raw events** for a soccer team → ESPN's schedule endpoint sometimes
  just hasn't loaded that team's current-season fixtures yet, even when the
  season/fixtures are public knowledge elsewhere. There's no reliable fix
  from our side beyond the `?fixture=true` workaround already applied — if
  it's still empty, ESPN's data is the bottleneck, not the code. This is
  exactly the situation football-data.org was added to work around for
  Chelsea/Chelsea Women specifically — see section 13.
- **Events present but everything still shows 0/0** → team-matching bug;
  should be fixed now (matching uses the response's own `team.id` instead of
  a guessed abbreviation), but if you ever add a new team and it breaks
  again, check this first.

## 12. Cricket sources: BCCI (stats.bcci.tv) + cricketdata.org fallback, and why KKR is off

Cricket comes from three BCCI endpoints, all no-API-key, plain JSON. As of
Aug 2026 these replaced BCCI's older `scores.bcci.tv`/`scores.iplt20.com`
JSONP feeds, which stopped working (BCCI changed their infrastructure) —
no more JSONP-wrapper stripping, and no more per-competition two-hop
discovery dance: every row across all three carries the match's own
numeric `team1_id`/`team2_id`, so matching a tracked team is a direct
comparison.

- **`stats.bcci.tv/match/fixtures/`** — one flat list of every match BCCI
  tracks, confirmed from a real sample: ~2000 rows spanning every
  competition worldwide, `match_status` of `"live"` or `"forthcoming"`.
  Used for the **upcoming schedule**. A genuine upgrade over the old
  feed: confirmed 38 upcoming India matches spanning months, a real
  forward schedule rather than a rolling few-day window.
- **`stats.bcci.tv/match/live_scores`** — a small, fast companion feed:
  only matches currently `"live"` (or very recently `"complete"` — a
  short rolling window). Used for **live scores**.
- **`stats.bcci.tv/match/results`** — paginated (100/page, ~30k rows
  total, sorted most-recent-first). Used for **recent CONCLUDED
  results**. Only page 1 is fetched — cricket is played somewhere in the
  world almost daily, so India's most recent match is essentially always
  within the most recent 100 global results (confirmed: a real sample of
  page 1 alone had 15 India men's and 4 India women's results). Unlike
  the other two feeds, this one has a clean `winner_team_id` field
  (confirmed from a real sample) — no more inferring win/loss from a
  human-readable result string.
- **cricketdata.org** (CricAPI v1, needs `CRICKETDATA_API_KEY`) — kept
  only as a **fallback for India men's recent result**, in case the BCCI
  results feed above is ever unreachable. Not consulted for India Women.
  If `CRICKETDATA_API_KEY` isn't set and BCCI's results feed is fine,
  nothing is lost — the warning at boot is just informational.

**India men (`INDM`) and India Women (`INDW`) — both active.** Confirmed
working end to end against real sample responses from all three BCCI
feeds: `team_id` `"6"` (men) and `"2295"` (women) both correctly matched
live, upcoming, AND recent-result rows — including a real Test-match
recent result parsed correctly from `results.json` (multi-innings score
line built from the same `summary.innings` shape the live feed uses).

**KKR — still commented out in `CRICKET_TEAMS`, not deleted.** Revisit
closer to IPL season. Its `team_id` isn't known yet — IPL is currently
off-season, so no KKR rows exist in any of the three feeds right now to
read an id from. The good news: since these feeds are unified across
every competition (confirmed: international bilateral series and
domestic first-class cricket — Duleep Trophy — both showed up in the same
`fixtures.json` response), there's no more separate-domain guesswork like
the old `scores.iplt20.com` situation. **Once IPL fixtures are announced,
don't just assume this same `stats.bcci.tv` shape still applies** — BCCI
has changed its feed infrastructure before (see the intro to this
section, on the old `scores.bcci.tv`/`scores.iplt20.com` JSONP feeds that
stopped working) — so re-check that `stats.bcci.tv` is still the live
source and that `team1_id`/`team2_id` are still the right fields before
trusting an id pulled from it. Once confirmed, find KKR's id the same way
India's were confirmed: pull a live IPL fixture from `fixtures.json` and
read its `team1_id`/`team2_id`, then uncomment its line in
`CRICKET_TEAMS`.

Until then, KKR will simply show nothing — the same empty-but-safe
failure mode as any other source-not-yet-confirmed case in this app.

## 13. football-data.org: Chelsea fixture source

Chelsea's men's Premier League fixtures are fetched by Flask from
football-data.org and merged into the same `/api/scores` response as the
backend cricket feeds. The browser does **not** call football-data.org and the
API token is **not** present in the frontend.

Set this environment variable in your deployment:

```text
FOOTBALL_DATA_API_KEY=your_football_data_org_token
```

For PythonAnywhere, add it under **Web → Environment variables**. For local
development, put it in `.env` next to `app.py` (or export it in the shell).

The backend uses football-data.org team ID `61` for Chelsea and requests
fixtures from today's date onward. It filters the returned matches locally for
`SCHEDULED` and `TIMED`, so finalized kickoff times are included. It also fetches
the most recent `FINISHED` result.

After deploying, the quickest diagnostic is to open:

```text
https://yourusername.pythonanywhere.com/api/scores?force=1
```

Look for a Chelsea object in `upcoming`. The application log should also show
a line similar to:

```text
football-data CHE: 1 upcoming fixture(s), 1 recent result(s)
```

If that line instead says the token is missing or the request failed, fix the
server environment variable/network access before debugging the frontend.
