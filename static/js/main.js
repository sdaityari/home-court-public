/**
 * Home Court — entry point. Loaded via <script type="module"> at the
 * bottom of index.html.
 *
 * Owns the fetch/merge pipeline: fetches the three independent pieces
 * (backend cricket+Chelsea, ESPN team sports, tennis), caches each
 * piece's last result, and recombines them into the data render.js
 * displays whenever any one piece refreshes. Also wires up every
 * top-level DOM control (dark mode, filter panel, manual refresh, the
 * full-schedule toggle, the clock).
 *
 * Sport-scoped views (/sport/<sport>, see scope.js): loadEspnTeamsData
 * and loadTennisData already only fetch what filters.js's
 * buildActiveEspnTeams/buildActiveTennisAthletes hand back, and those are
 * themselves sport-scoped — so ESPN/tennis are naturally narrowed with no
 * extra filtering here. The backend feed (/api/scores — cricket +
 * Chelsea) is NOT sport-scoped server-side, since it's one shared
 * endpoint for every deployment; mergeAndRender applies the same
 * sportMatches() check to it that filters.js applies everywhere else.
 */

import { buildActiveEspnTeams, buildActiveTennisAthletes, renderFilterTeams, updateFilterBtnActiveState, initFilterCallbacks, setTennisPlayerCatalog, isHomeHidden } from './filters.js';
import { applyData, setScheduleMode, teamOf, refreshFooterText } from './render.js';
import { fetchEspnSchedule, classifyEspnEvents, fetchEventSummary, liveScoreFromSummary, pickSummaryLeague } from './espn.js';
import { fetchTennisSchedule, classifyTennisEvents, collectTennisPlayers } from './tennis.js';
import { parseDate, formatWhenClient, formatDateForSearch, attachHighlight, dedupeFixtures } from './utils.js';
import { sportMatches } from './scope.js';

const footerStatus = document.getElementById('footerStatus');
const refreshBtn = document.getElementById('refreshBtn');

// Cached results from the three independent fetch pieces — each refreshed
// on its own schedule (backend: every 15 min; ESPN teams: every 15 min or
// on a filter change; tennis: every 15 min, or reclassified from cache on
// a filter change), then recombined by mergeAndRender below.
let lastBackendData = { live: [], upcoming: [], recent: [], updated_at: null };
let lastEspnTeamsResult = { live: [], upcoming: [], recent: [] };
let lastTennisResult = { live: [], upcoming: [], recent: [] };
// league -> raw ESPN tennis events, so a filter-only change (see
// refreshTennisOnly) can reclassify without refetching the whole tour.
const tennisEventsCache = { atp: null, wta: null };

initFilterCallbacks(refreshEspnTeamsOnly, refreshTennisOnly, mergeAndRender);

  async function loadEspnTeamsData() {
    const live = [], upcoming = [], recent = [];
    const teams = buildActiveEspnTeams();

    await Promise.all(Object.entries(teams).map(async ([code, cfg]) => {
      try {
        const { events, teamId } = await fetchEspnSchedule(cfg);
        const { live: l, upcoming: espnUpcoming, recent: espnRecent } =
          classifyEspnEvents(events, code, cfg, teamId);
        if (l.length) {
          // Patch each live game's schedule-based placeholder score with
          // the real one from that event's own summary endpoint — see the
          // comment above classifyEspnEvents' live branch for why the
          // schedule endpoint's score can't be trusted while a game is
          // still in progress.
          const summaryLeague = pickSummaryLeague(cfg);
          if (summaryLeague) {
            await Promise.all(l.map(async (g) => {
              const body = await fetchEventSummary(cfg.sport, summaryLeague, g.eventId);
              const scores = liveScoreFromSummary(body, teamId);
              if (scores) {
                g.teamScore = String(scores.usScore);
                g.oppScore = String(scores.themScore);
              }
            }));
          }
          live.push(...l);
        }
        if (espnUpcoming.length) upcoming.push(...espnUpcoming);
        if (espnRecent.length) {
          const recentWithHighlights = await Promise.all(espnRecent.map(r => attachHighlight(r, cfg.displayName)));
          recent.push(...recentWithHighlights);
        }
      } catch (e) {
        console.warn(`ESPN fetch failed for ${code}:`, e);
      }
    }));

    return { live, upcoming, recent };
  }

  // forceFetch=false reuses tennisEventsCache instead of hitting the network
  // — used when only the SET OF TRACKED PLAYERS changed (a filter toggle),
  // since the tour-wide fetch already has every player's data regardless of
  // which ones are currently checked.
  async function loadTennisData(forceFetch) {
    const live = [], upcoming = [], recent = [];
    const athletes = buildActiveTennisAthletes();

    await Promise.all(['atp', 'wta'].map(async (league) => {
      try {
        let events = tennisEventsCache[league];
        if (forceFetch || !events) {
          events = await fetchTennisSchedule(league);
          tennisEventsCache[league] = events;
          setTennisPlayerCatalog(league, collectTennisPlayers(events));
        }
        const leagueAthletes = Object.entries(athletes).filter(([, cfg]) => cfg.league === league);
        for (const [code, cfg] of leagueAthletes) {
          const { live: l, upcoming: tennisUpcoming, recent: tennisRecent } = classifyTennisEvents(events, code, cfg);
          if (l.length) live.push(...l);
          if (tennisUpcoming.length) upcoming.push(...tennisUpcoming);
          if (tennisRecent.length) {
            const recentWithHighlights = await Promise.all(
              tennisRecent.map(r => attachHighlight(r, cfg.displayName))
            );
            recent.push(...recentWithHighlights);
          }
        }
      } catch (e) {
        console.warn(`Tennis ${league.toUpperCase()} fetch failed:`, e);
      }
    }));

    return { live, upcoming, recent };
  }

  // Recombines the three cached pieces (backend + ESPN teams + tennis) and
  // re-renders — no fetching here, just merge/sort/render, so this is safe
  // to call after ANY of the three pieces refreshes on its own.
  function mergeAndRender() {
    const backendData = lastBackendData || { live: [], upcoming: [], recent: [], updated_at: null };
    const backendKeep = (g) => !isHomeHidden(g.team) && sportMatches(teamOf(g.team).sport);
    const backendLive = (backendData.live || []).filter(backendKeep);
    const backendUpcoming = (backendData.upcoming || []).filter(backendKeep);
    const backendRecent = (backendData.recent || []).filter(backendKeep);

    const mappedUpcoming = backendUpcoming.map(g => ({
      ...g,
      rawWhen: parseDate(g.when || g.rawWhen),
      when: typeof g.when === 'string' && g.when.includes('·') ? g.when : formatWhenClient(g.when || g.rawWhen),
    }));

    const mappedRecent = backendRecent.map(g => ({
      ...g,
      rawWhen: parseDate(g.when || g.rawWhen),
      when: typeof g.when === 'string' && g.when.includes('·') ? g.when : formatWhenClient(g.when || g.rawWhen),
      highlight: g.highlight || `https://www.youtube.com/results?search_query=${encodeURIComponent(teamOf(g.team).name + ' vs ' + g.opponent + ' ' + formatDateForSearch(g.when || g.rawWhen) + ' highlights')}`,
    }));

    const mappedLive = backendLive.map(g => ({ ...g }));

    const mergedUpcoming = dedupeFixtures([...lastEspnTeamsResult.upcoming, ...lastTennisResult.upcoming, ...mappedUpcoming])
      .sort((a, b) => new Date(a.rawWhen || a.when) - new Date(b.rawWhen || b.when));

    const mergedRecent = dedupeFixtures([...lastEspnTeamsResult.recent, ...lastTennisResult.recent, ...mappedRecent])
      .sort((a, b) => new Date(b.rawWhen || b.when) - new Date(a.rawWhen || a.when));

    applyData({
      updated_at: backendData.updated_at,
      live: dedupeFixtures([...lastEspnTeamsResult.live, ...lastTennisResult.live, ...mappedLive]),
      upcoming: mergedUpcoming,
      recent: mergedRecent,
    });
  }

  async function loadScores(force) {
    try {
      const [backendData, teamsResult, tennisResult] = await Promise.all([
        fetch(`/api/scores${force ? '?force=1' : ''}`).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        loadEspnTeamsData(),
        loadTennisData(true),
      ]);
      lastBackendData = backendData;
      lastEspnTeamsResult = teamsResult;
      lastTennisResult = tennisResult;
      mergeAndRender();
      renderFilterTeams();
      updateFilterBtnActiveState();
    } catch (err) {
      console.error('Failed to load scores:', err);
      footerStatus.textContent = 'COULD NOT REACH SERVER · RETRYING SOON';
    }
  }

  // Only re-fetches the currently-checked ESPN teams — this is the real
  // new API call the filter makes, and only for baseball/basketball/soccer,
  // and only when one of those checkboxes actually changes.
  async function refreshEspnTeamsOnly() {
    try {
      lastEspnTeamsResult = await loadEspnTeamsData();
      mergeAndRender();
    } catch (e) {
      console.warn('Failed to refresh extra teams:', e);
    }
  }

  // Reclassifies from the already-cached tour data — zero new network
  // calls, regardless of how many tennis players are toggled on or off.
  async function refreshTennisOnly() {
    try {
      lastTennisResult = await loadTennisData(false);
      mergeAndRender();
    } catch (e) {
      console.warn('Failed to refresh tennis filter:', e);
    }
  }

  loadScores(false);
  setInterval(() => loadScores(false), 15 * 60 * 1000);   
  setInterval(refreshFooterText, 30000);                  

  function updateClock() {
    const el = document.getElementById('clock');
    const now = new Date();
    const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    el.textContent = now.toLocaleString('en-US', opts).replace(',', ' —') + ' ET';
  }
  updateClock();
  setInterval(updateClock, 30000);

  const darkModeToggle = document.getElementById('darkModeToggle');
  function setDarkModePressed(isDark) {
    darkModeToggle.setAttribute('aria-pressed', String(isDark));
  }
  setDarkModePressed(document.documentElement.getAttribute('data-theme') === 'dark');
  darkModeToggle.addEventListener('click', function() {
    const goingDark = document.documentElement.getAttribute('data-theme') !== 'dark';
    if (goingDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    setDarkModePressed(goingDark);
    try { localStorage.setItem('homecourt-theme', goingDark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  });

  // 3-way schedule range: Compact / 7 Days / Full — a radio group of plain
  // buttons rather than native radio inputs, to match the rest of the
  // panel's button-driven controls (dark-mode icon, filter chips).
  const scheduleSeg = document.getElementById('scheduleSeg');
  const scheduleButtons = [...scheduleSeg.querySelectorAll('.seg-btn')];
  function setScheduleButton(mode) {
    scheduleButtons.forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  }
  let savedScheduleMode = 'compact';
  try { savedScheduleMode = localStorage.getItem('homecourt-schedule-mode') || 'compact'; } catch (e) { /* ignore */ }
  setScheduleButton(savedScheduleMode);
  setScheduleMode(savedScheduleMode);
  scheduleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setScheduleButton(mode);
      setScheduleMode(mode);
      try { localStorage.setItem('homecourt-schedule-mode', mode); } catch (e) { /* ignore */ }
    });
  });

  const filterBtn = document.getElementById('filterBtn');
  const filterPanel = document.getElementById('filterPanel');
  filterBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const opening = filterPanel.hidden;
    filterPanel.hidden = !opening;
    filterBtn.setAttribute('aria-expanded', String(opening));
  });
  filterPanel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => {
    if (!filterPanel.hidden) {
      filterPanel.hidden = true;
      filterBtn.setAttribute('aria-expanded', 'false');
    }
  });

  refreshBtn.addEventListener('click', function() {
    this.classList.add('spinning');
    loadScores(true).finally(() => setTimeout(() => this.classList.remove('spinning'), 600));
  });
