# Home Court — Personal Sports Dashboard

A self-built scoreboard tracking live scores, upcoming fixtures, and recent
results across MLB (Yankees), NBA (Knicks), EPL/WSL/NWSL (Chelsea Men's /
Women's, Gotham FC), tennis (ATP/WTA), and cricket (India Men's / Women's,
KKR — see note below).

- **Backend:** `app.py` (Flask entry point) + `config.py`, `cache.py`,
  `scores.py`, and `services/` (`bcci.py`, `cricketdata.py`,
  `football_data.py`, `youtube.py`) — handles cricket (BCCI feeds) and
  Chelsea's football-data.org fixtures server-side, and proxies YouTube
  highlight lookups so that API key never reaches the browser.
- **Frontend:** `templates/index.html` (markup only) + `static/css/styles.css`
  and `static/js/` (ES modules: `teams.js`, `utils.js`, `tennis.js`, `espn.js`,
  `filters.js`, `render.js`, `main.js`) — fetches MLB, NBA, EPL/WSL/NWSL, and
  tennis data *directly from the browser*, since ESPN's public API blocks
  requests from cloud/server IPs (confirmed on Render).

For a deep dive into data sources, caching, and troubleshooting, see
[`DEPLOY.md`](DEPLOY.md).

**Quick links:** [Deploying on Render](#deploying-on-render) ·
[Changing which teams/players are tracked](#changing-which-teamsplayers-are-tracked) ·
[Changing selectable competitors/rivals](#changing-selectable-competitorsrivals-the-filter-panel)

---

## Deploying on Render

1. **Push this project to a GitHub (or GitLab) repo.** Keep the folder
   structure as-is:
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

2. **Create a new Web Service on Render**
   - [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
   - Connect the repo you just pushed.
   - **Environment:** Python 3
   - **Build Command:**
     ```
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```
     gunicorn app:app
     ```
   - Leave **Root Directory** blank if `app.py` sits at the repo root.

3. **Add environment variables** (Render dashboard → your service →
   **Environment** tab → **Add Environment Variable**):

   | Key | Required? | Purpose |
   |---|---|---|
   | `YOUTUBE_API_KEY` | Optional | Resolves a direct YouTube highlight video link for each completed game. Without it, the app falls back to a plain YouTube search-results link — still works, just less precise. |
   | `FOOTBALL_DATA_API_KEY` | Optional (needed for Chelsea) | A [football-data.org](https://www.football-data.org/) API token, used to fetch Chelsea's Premier League fixtures/results server-side. Without it, Chelsea simply won't show football-data results (ESPN client-side fetch may still partially cover it). |
   | `CRICKETDATA_API_KEY` | Optional | A [cricketdata.org](https://cricketdata.org/) (CricAPI) key, used only as a fallback for India Men's most recent result if BCCI's own feed is ever unreachable. Harmless to leave unset. |
   | `CACHE_TTL_SECONDS` | Optional | How long `/api/scores` caches before refetching. Default `900` (15 min). |
   | `HIGHLIGHT_CACHE_TTL_SECONDS` | Optional | How long a resolved YouTube highlight link is cached. Default `21600` (6 hr). |
   | `BCCI_FIXTURES_TTL_SECONDS` | Optional | Cache TTL for BCCI's upcoming-schedule feed. Default `1800` (30 min). |
   | `BCCI_LIVE_TTL_SECONDS` | Optional | Cache TTL for BCCI's live-score feed. Default `300` (5 min). |
   | `BCCI_RESULTS_TTL_SECONDS` | Optional | Cache TTL for BCCI's results feed. Default `900` (15 min). |
   | `FLASK_DEBUG` | Optional | Set to `1` for verbose local debugging. Leave unset (`0`) in production. |

   You do **not** need to set `PORT` — Render sets it automatically and
   `app.py` already reads `$PORT`.

4. **Deploy.** Render will build and give you a public URL
   (`https://your-app.onrender.com`). Open it — you should see the
   scoreboard.

5. **Verify it's working:**
   - Visit `https://your-app.onrender.com/api/scores` directly — you
     should get back JSON with `live`/`upcoming`/`recent` arrays
     (cricket + Chelsea, if `FOOTBALL_DATA_API_KEY` is set).
   - Open the deployed page itself and check the browser DevTools →
     Network tab for requests to `site.api.espn.com` — a `200` response
     means MLB/NBA/EPL/WSL/NWSL are working client-side as expected.
   - Check the Render **Logs** tab for warnings — every failed fetch logs
     which host it couldn't reach and why.

---

## Adding or changing environment variables on Render (API keys)

Render → your service → **Environment** tab → **Add Environment Variable**
→ enter the key/value → **Save Changes**. Render will automatically
redeploy the service with the new variable available. No code changes
needed — `app.py` reads all of these via `os.getenv(...)` at startup.

---

## Changing which teams/players are tracked

There are two tiers:

- **Tracked (always-on)** — shown by default, no user interaction needed.
- **Competitors/rivals (off by default)** — selectable in the on-page
  filter panel; a user can toggle them on, and they persist via the
  browser's local storage.

### Tracked teams — MLB / NBA / EPL / WSL / NWSL

Edit the **`ESPN_TEAMS`** object in `static/js/teams.js`:

```js
const ESPN_TEAMS = {
  NYY:  { sport: "baseball",   leagues: ["mlb"], team: "nyy",   displayName: "Yankees" },
  NYK:  { sport: "basketball", leagues: ["nba"], team: "ny",    displayName: "Knicks" },
  CHE:  { sport: "soccer", leagues: ["all"], team: "363",   displayName: "Chelsea" },
  ...
};
```

To find a new team's ESPN `team` id, open (swapping in the right sport/league):
```
https://site.api.espn.com/apis/site/v2/sports/<sport>/<league>/teams
```
and copy the `id` (or lowercase abbreviation, for MLB/NBA) from the JSON.

You'll also need to add a matching entry to the **`TEAMS`** object (same
file, `static/js/teams.js`) — this is what supplies the badge color, logo,
and display name shown in the UI:

```js
TEAMS: {
  NYY: { name: "Yankees", league: "MLB", color: "#C4CED4", sport: "baseball",
         logo: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", initials: "NYY" },
  ...
}
```

### Tracked athletes — Tennis

Edit **`TENNIS_ATHLETES`** in `static/js/teams.js`:

```js
const TENNIS_ATHLETES = {
  ALC: { sport: "tennis", league: "atp", id: "3782", displayName: "Carlos Alcaraz" },
  ...
};
```

Find a player's ESPN id from their ESPN player page URL
(`espn.com/tennis/player/_/id/<id>/...`). Add a matching entry to `TEAMS`
as above (with `sport: "tennis"`).

### Tracked teams — Cricket

Edit **`CRICKET_TEAMS`** in `services/bcci.py` (search for `CRICKET_TEAMS = {`):

```python
CRICKET_TEAMS = {
    "INDM": {"name": "India", "team_id": "6"},
    "INDW": {"name": "India Women", "team_id": "2295"},
}
```

Cricket team IDs come from BCCI's own feed, not ESPN. To find a team's
`team_id`, pull a live/upcoming match involving that team from
`https://stats.bcci.tv/match/fixtures/` and read its `team1_id`/`team2_id`.

**KKR is currently commented out** in this dict (not deleted) because IPL
is off-season, so its `team_id` isn't known yet — no KKR rows exist in
BCCI's feed to read an id from right now. Once IPL fixtures are announced,
don't just assume the current feed shape still applies — BCCI has changed
its feed infrastructure before (see `DEPLOY.md` section 12), so double
check that `stats.bcci.tv` is still the live source and that
`team1_id`/`team2_id` are still the right fields before trusting an id
pulled from it. Once confirmed, pull a live KKR fixture from
`https://stats.bcci.tv/match/fixtures/`, read its `team_id`, and uncomment
its line. A `KKR` badge entry already exists in `static/js/teams.js`'s
`TEAMS` object, so no frontend change is needed once it's uncommented.

As with the other sports, also add/update the matching entry in `TEAMS` in
`static/js/teams.js` for the badge/logo.

---

## Changing selectable competitors/rivals (the filter panel)

These are teams and players a user can turn on manually — they don't
trigger tracking by default.

- **MLB / NBA / EPL rivals:** edit **`EXTRA_TEAM_CATALOG`** in
  `static/js/teams.js`. Each entry needs both the display fields (name,
  color, logo) and an `espn: {...}` sub-object (same shape as `ESPN_TEAMS`
  entries above):
  ```js
  ARS: { name: "Arsenal", league: "EPL", color: "#EF0107", sport: "soccer",
         logo: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", initials: "ARS",
         espn: { sport: "soccer", leagues: ["eng.1"], team: "359", displayName: "Arsenal" } },
  ```

- **Tennis competitors:** edit **`EXTRA_TENNIS_CATALOG`** in
  `static/js/teams.js`, keyed `"league:id"`:
  ```js
  'atp:296': { league: 'atp', id: '296', name: 'Novak Djokovic' },
  ```
  No `espn` sub-object needed here — the whole ATP/WTA tour is already
  fetched, so adding a name here just makes that player toggle-able.

---

## Troubleshooting

For deeper troubleshooting (empty cricket section, ESPN teams showing
nothing, verifying football-data/BCCI feeds, reading the logs), see
sections 8–13 of [`DEPLOY.md`](DEPLOY.md) — the diagnostics there apply
the same way on Render as PythonAnywhere; just check Render's **Logs** tab
instead of PythonAnywhere's error log.
