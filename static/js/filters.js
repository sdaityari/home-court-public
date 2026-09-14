/**
 * Team-filter panel: which rival teams/players (beyond the always-tracked
 * roster in teams.js) the user has switched on, plus which of the
 * always-tracked HOME teams/athletes the user has chosen to hide —
 * persisted to localStorage, plus the panel's own DOM rendering.
 *
 * Owns extraEspnTeamCodes/extraTennisPlayers/hiddenHomeCodes/
 * tennisPlayerCatalog/tennisSearchQuery — the only module that reassigns
 * them — so other modules read them via the exported functions/getters
 * below rather than importing the bindings directly.
 *
 * main.js supplies the two callbacks below once, at startup, so a chip
 * toggle here can trigger the right kind of refresh (a new ESPN fetch vs.
 * a zero-network tennis reclassify) without filters.js needing to import
 * the fetch pipeline itself.
 *
 * Sport-scoped views (/sport/<sport>, see scope.js): every list this
 * module builds — the active-fetch lists AND the filter panel itself —
 * is narrowed to sportMatches() first, so a sport-specific page never
 * fetches, shows, or lets you toggle on another sport's teams/rivals.
 */

import { TEAMS, ESPN_TEAMS, TENNIS_ATHLETES, EXTRA_TEAM_CATALOG, EXTRA_TENNIS_CATALOG } from './teams.js';
import { sportMatches, CURRENT_SPORT } from './scope.js';

// India / India Women are fetched server-side (BCCI), not via ESPN_TEAMS,
// so they don't appear in that loop the way other home teams do — this is
// just the small hard-coded list of which TEAMS codes belong in the
// filter panel's CRICKET group. No rival catalog exists for cricket, so
// this group is always hide/show-only, same as WSL/NWSL.
const HOME_CRICKET_CODES = ['INDM', 'INDW'];

let _onEspnChange = () => {};
let _onTennisChange = () => {};
let _onBackendChange = () => {};

export function initFilterCallbacks(onEspnChange, onTennisChange, onBackendChange) {
  _onEspnChange = onEspnChange;
  _onTennisChange = onTennisChange;
  _onBackendChange = onBackendChange || (() => {});
}

export function isHomeHidden(code) {
  return hiddenHomeCodes.has(code);
}

// render.js's teamOf() looks up display info (name/id/league) for any
// active 'EX_<league>:<id>' tennis code here. That used to always be
// extraTennisPlayers itself, since toggling a named-catalog rival on used
// to mirror it into that map regardless of context. Now that a
// sport-scoped view can activate a named-catalog rival by default (via
// isTennisRivalActive) without ever touching extraTennisPlayers, this
// merges the catalog in underneath it so lookups still resolve — a
// search-added player (not in the catalog) still only ever lives in
// extraTennisPlayers, which is layered on top here so it always wins.
export function getExtraTennisPlayers() {
  const merged = new Map();
  for (const [key, entry] of Object.entries(EXTRA_TENNIS_CATALOG)) {
    merged.set(key, { id: entry.id, league: entry.league, displayName: entry.name });
  }
  for (const [key, p] of extraTennisPlayers) merged.set(key, p);
  return merged;
}

export function setTennisPlayerCatalog(league, map) {
  tennisPlayerCatalog[league] = map;
}

  // ---- Team filter state ----
  let extraEspnTeamCodes = new Set();
  let extraTennisPlayers = new Map();
  // Codes (from ESPN_TEAMS or TENNIS_ATHLETES) the user has chosen to hide
  // from their own always-tracked roster — the fetch/classify pipeline
  // still treats "home" as everyone in ESPN_TEAMS/TENNIS_ATHLETES minus
  // this set. Cricket (KKR/IND*) has no filter UI at all today, so it's
  // intentionally not part of this hide mechanism.
  let hiddenHomeCodes = new Set();
  // On a /sport/<sport> view, rival teams/competitors default to ON
  // (mirrors hiddenHomeCodes' "on unless hidden" model) rather than OFF —
  // these two sets are what an explicit opt-OUT looks like there. They're
  // only consulted when CURRENT_SPORT is set; the unscoped "/" view keeps
  // its original default-OFF/opt-in behavior via extraEspnTeamCodes/
  // extraTennisPlayers above, unaffected by these.
  let hiddenExtraEspnCodes = new Set();
  let hiddenExtraTennisKeys = new Set();
  // league -> Map(athleteId -> displayName), every player seen in the last
  // tour fetch — the pool the tennis search box searches against. Not
  // rendered as chips by default (see renderFilterTeams) unless matched.
  let tennisPlayerCatalog = { atp: new Map(), wta: new Map() };
  // Current text in the tennis search box — module state so a chip toggle
  // (which re-renders the whole panel) doesn't clear what was typed.
  let tennisSearchQuery = '';

export function loadFilterSelections() {
    try {
      const codes = JSON.parse(localStorage.getItem('homecourt-extra-teams') || '[]');
      extraEspnTeamCodes = new Set(codes.filter(c => EXTRA_TEAM_CATALOG[c]));
    } catch (e) { extraEspnTeamCodes = new Set(); }
    try {
      const players = JSON.parse(localStorage.getItem('homecourt-extra-tennis') || '[]');
      extraTennisPlayers = new Map(players.map(p => [`${p.league}:${p.id}`, p]));
    } catch (e) { extraTennisPlayers = new Map(); }
    try {
      const hidden = JSON.parse(localStorage.getItem('homecourt-hidden-home') || '[]');
      hiddenHomeCodes = new Set(hidden.filter(c => ESPN_TEAMS[c] || TENNIS_ATHLETES[c] || HOME_CRICKET_CODES.includes(c)));
    } catch (e) { hiddenHomeCodes = new Set(); }
    try {
      const hiddenExtra = JSON.parse(localStorage.getItem('homecourt-hidden-extra-teams') || '[]');
      hiddenExtraEspnCodes = new Set(hiddenExtra.filter(c => EXTRA_TEAM_CATALOG[c]));
    } catch (e) { hiddenExtraEspnCodes = new Set(); }
    try {
      const hiddenExtraTennis = JSON.parse(localStorage.getItem('homecourt-hidden-extra-tennis') || '[]');
      hiddenExtraTennisKeys = new Set(hiddenExtraTennis.filter(k => EXTRA_TENNIS_CATALOG[k]));
    } catch (e) { hiddenExtraTennisKeys = new Set(); }
  }

export function saveFilterSelections() {
    try {
      localStorage.setItem('homecourt-extra-teams', JSON.stringify([...extraEspnTeamCodes]));
      localStorage.setItem('homecourt-extra-tennis', JSON.stringify([...extraTennisPlayers.values()]));
      localStorage.setItem('homecourt-hidden-home', JSON.stringify([...hiddenHomeCodes]));
      localStorage.setItem('homecourt-hidden-extra-teams', JSON.stringify([...hiddenExtraEspnCodes]));
      localStorage.setItem('homecourt-hidden-extra-tennis', JSON.stringify([...hiddenExtraTennisKeys]));
    } catch (e) { /* localStorage unavailable — selections just won't persist across reloads */ }
  }

  loadFilterSelections();

  // Whether a given EXTRA_TEAM_CATALOG rival is currently active. On a
  // /sport/<sport> view, every rival for that sport is ON by default —
  // hiddenExtraEspnCodes is the opt-out. On the unscoped "/" view, rivals
  // stay OFF by default — extraEspnTeamCodes is the opt-in, unchanged
  // from the original behavior.
  function isEspnRivalActive(code) {
    return CURRENT_SPORT ? !hiddenExtraEspnCodes.has(code) : extraEspnTeamCodes.has(code);
  }

  // Same default-flip for a named tennis rival, keyed "league:id" (matches
  // EXTRA_TENNIS_CATALOG/extraTennisPlayers).
  function isTennisRivalActive(key) {
    return CURRENT_SPORT ? !hiddenExtraTennisKeys.has(key) : extraTennisPlayers.has(key);
  }

  // Merges the always-on tracked teams (minus any the user hid) with
  // whichever extras are currently checked — this IS the fetch list, so
  // checking a box here is what actually triggers loadEspnTeamsData to
  // hit that team's schedule.
export function buildActiveEspnTeams() {
    const active = {};
    for (const [code, cfg] of Object.entries(ESPN_TEAMS)) {
      if (!sportMatches(cfg.sport)) continue;
      if (!hiddenHomeCodes.has(code)) active[code] = cfg;
    }
    for (const [code, entry] of Object.entries(EXTRA_TEAM_CATALOG)) {
      if (!sportMatches(entry.sport)) continue;
      if (isEspnRivalActive(code)) active[code] = entry.espn;
    }
    return active;
  }

  // Same idea for tennis, but this never changes what gets fetched — only
  // which of the already-fetched tour's players get classified/rendered.
  // Tennis athletes are always sport 'tennis', so a single sportMatches
  // check up front is enough to empty this out entirely on any other
  // sport's view (and with it, skip the tour fetch in loadTennisData).
export function buildActiveTennisAthletes() {
    const active = {};
    if (!sportMatches('tennis')) return active;
    for (const [code, cfg] of Object.entries(TENNIS_ATHLETES)) {
      if (!hiddenHomeCodes.has(code)) active[code] = cfg;
    }
    for (const [key, entry] of Object.entries(EXTRA_TENNIS_CATALOG)) {
      if (isTennisRivalActive(key)) active[`EX_${key}`] = { sport: 'tennis', league: entry.league, id: entry.id, displayName: entry.name };
    }
    for (const [key, p] of extraTennisPlayers) {
      if (EXTRA_TENNIS_CATALOG[key]) continue; // already covered by the named-catalog loop above
      active[`EX_${key}`] = { sport: 'tennis', league: p.league, id: p.id, displayName: p.displayName };
    }
    return active;
  }

  function refreshAfterChange(kind) {
    saveFilterSelections();
    updateFilterBtnActiveState();
    renderFilterTeams();
    if (kind === 'espn') _onEspnChange();
    else if (kind === 'tennis') _onTennisChange();
    else if (kind === 'backend') _onBackendChange();
  }

export function renderFilterTeams() {
    const container = document.getElementById('filterTeams');
    if (!container) return;

    // Preserve focus/caret in the tennis search box across the re-render
    // below, since it rebuilds the whole panel's innerHTML on every
    // keystroke and toggle.
    const activeInput = container.querySelector('#tennisSearchInput');
    const hadFocus = activeInput && document.activeElement === activeInput;
    const caret = hadFocus ? activeInput.selectionStart : null;

    const groups = {}; // league -> { home: [...], rivals: [...] }
    const ensureGroup = (league) => (groups[league] ||= { home: [], rivals: [] });

    for (const [code, cfg] of Object.entries(ESPN_TEAMS)) {
      if (!sportMatches(cfg.sport)) continue;
      const t = TEAMS[code];
      if (!t) continue;
      ensureGroup(t.league).home.push({ kind: 'home-espn', code, name: t.name, logo: t.logo, color: t.color, hidden: hiddenHomeCodes.has(code) });
    }
    if (sportMatches('tennis')) {
      for (const [code] of Object.entries(TENNIS_ATHLETES)) {
        const t = TEAMS[code];
        if (!t) continue;
        ensureGroup(t.league).home.push({ kind: 'home-tennis', code, name: t.name, logo: null, color: t.color, hidden: hiddenHomeCodes.has(code) });
      }
    }
    if (sportMatches('cricket')) {
      for (const code of HOME_CRICKET_CODES) {
        const t = TEAMS[code];
        if (!t) continue;
        ensureGroup('CRICKET').home.push({ kind: 'home-backend', code, name: t.name, logo: t.logo, color: t.color, hidden: hiddenHomeCodes.has(code) });
      }
    }

    for (const [code, entry] of Object.entries(EXTRA_TEAM_CATALOG)) {
      if (!sportMatches(entry.sport)) continue;
      ensureGroup(entry.league).rivals.push({ kind: 'espn', code, name: entry.name, checked: isEspnRivalActive(code) });
    }

    // Tennis rivals: the named catalog + anything already checked are
    // always shown; the full fetched-tour pool only surfaces when its
    // name matches the current search text, so the panel doesn't get
    // flooded with every player from an active tournament week by default.
    const query = tennisSearchQuery.trim().toLowerCase();
    const trackedIds = new Set(Object.values(TENNIS_ATHLETES).map(a => String(a.id)));
    for (const league of (sportMatches('tennis') ? ['atp', 'wta'] : [])) {
      const pool = new Map(); // id -> displayName
      for (const entry of Object.values(EXTRA_TENNIS_CATALOG)) {
        if (entry.league === league) pool.set(entry.id, entry.name);
      }
      for (const [, p] of extraTennisPlayers) {
        if (p.league === league) pool.set(p.id, p.displayName);
      }
      if (query) {
        for (const [id, displayName] of (tennisPlayerCatalog[league] || new Map())) pool.set(id, displayName);
      }
      for (const [id, displayName] of pool) {
        if (trackedIds.has(id)) continue;
        if (query && !displayName.toLowerCase().includes(query)) continue;
        const key = `${league}:${id}`;
        const checked = EXTRA_TENNIS_CATALOG[key] ? isTennisRivalActive(key) : extraTennisPlayers.has(key);
        ensureGroup(league.toUpperCase()).rivals.push({
          kind: 'tennis', code: key, league, id, name: displayName, checked,
        });
      }
    }

    const leagueOrder = ['EPL', 'NFL', 'NBA', 'MLB', 'ATP', 'WTA', 'CRICKET', 'WSL', 'NWSL'];
    const orderedLeagues = [...leagueOrder, ...Object.keys(groups).filter(l => !leagueOrder.includes(l))]
      .filter(league => groups[league] && (groups[league].home.length || groups[league].rivals.length));

    if (!orderedLeagues.length) {
      container.innerHTML = '<div class="filter-empty">No other teams available yet.</div>';
      return;
    }

    const tennisLeagues = new Set(['ATP', 'WTA']);
    let searchInserted = false;

    container.innerHTML = orderedLeagues.map(league => {
      const { home, rivals } = groups[league];
      const items = rivals.slice().sort((a, b) => a.name.localeCompare(b.name));
      const allChecked = items.length > 0 && items.every(t => t.checked);

      let prefix = '';
      if (tennisLeagues.has(league) && !searchInserted) {
        searchInserted = true;
        prefix = `
        <div class="filter-league-group">
          <input type="search" class="filter-search" id="tennisSearchInput"
                 placeholder="Search any ATP/WTA player…" autocomplete="off"
                 value="${query.replace(/"/g, '&quot;')}">
        </div>`;
      }

      const homeChipsHtml = home.map(h => {
        const crest = (h.logo && !h.hidden) ? `<img class="chip-crest" src="${h.logo}" alt="" onerror="this.remove()">` : '';
        return `
        <span class="filter-chip home${h.hidden ? ' hidden-home' : ''}" data-home-code="${h.code}"
              style="--chip-color:${h.color}" title="${h.hidden ? 'Show' : 'Hide'} ${h.name}">
          ${crest}<span class="chip-label">${h.name}</span>
          <span class="chip-hide">${h.hidden ? '+' : '\u2715'}</span>
        </span>`;
      }).join('');

      const rivalChipsHtml = items.map(t => `
        <span class="filter-chip${t.checked ? ' on' : ''}" data-kind="${t.kind}" data-code="${t.code}"
              data-league="${t.league || ''}" data-id="${t.id || ''}" data-name="${t.name.replace(/"/g, '&quot;')}">
          <span class="chip-label">${t.name}</span>
        </span>`).join('');

      const switchHtml = items.length ? `
        <label class="filter-switch" title="Toggle all ${league} rivals">
          <input type="checkbox" class="filter-select-all" data-league="${league}" ${allChecked ? 'checked' : ''} aria-label="Toggle all ${league} rivals">
          <span class="track"></span>
        </label>` : '';

      return `${prefix}
      <div class="filter-league-group">
        <div class="filter-league-header">
          <span class="filter-league-title">${league}</span>
          ${switchHtml}
        </div>
        <div class="filter-chip-grid">${homeChipsHtml}${rivalChipsHtml}</div>
      </div>`;
    }).join('');

    // Restore search-box focus/caret across the re-render triggered by
    // typing in it.
    if (hadFocus) {
      const newInput = container.querySelector('#tennisSearchInput');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(caret, caret);
      }
    }

    // Takes a plain {kind, code, id, league, name} bag — either a chip's
    // .dataset (whose properties are exactly those data-* attributes) or
    // a manually-built object from the select-all handler below. On a
    // sport-scoped view, a named-catalog rival (EXTRA_TEAM_CATALOG /
    // EXTRA_TENNIS_CATALOG — on by default there) is toggled via the
    // hidden-extra opt-out sets instead of the opt-in ones, matching
    // isEspnRivalActive/isTennisRivalActive above. A tennis player found
    // only via search (not in the named catalog) has no default-on state
    // regardless of scope, so it always goes through the opt-in map.
    function applyRivalChange(data, checked) {
      if (data.kind === 'espn') {
        if (CURRENT_SPORT) {
          if (checked) hiddenExtraEspnCodes.delete(data.code); else hiddenExtraEspnCodes.add(data.code);
        } else {
          if (checked) extraEspnTeamCodes.add(data.code); else extraEspnTeamCodes.delete(data.code);
        }
      } else {
        const key = data.code;
        if (CURRENT_SPORT && EXTRA_TENNIS_CATALOG[key]) {
          if (checked) hiddenExtraTennisKeys.delete(key); else hiddenExtraTennisKeys.add(key);
        } else {
          if (checked) extraTennisPlayers.set(key, { id: data.id, league: data.league, displayName: data.name });
          else extraTennisPlayers.delete(key);
        }
      }
    }

    container.querySelectorAll('.filter-chip[data-kind]').forEach(chip => {
      chip.addEventListener('click', () => {
        const nowChecked = !chip.classList.contains('on');
        applyRivalChange(chip.dataset, nowChecked);
        refreshAfterChange(chip.dataset.kind === 'espn' ? 'espn' : 'tennis');
      });
    });

    container.querySelectorAll('.filter-chip.home').forEach(chip => {
      chip.addEventListener('click', () => {
        const code = chip.dataset.homeCode;
        if (hiddenHomeCodes.has(code)) hiddenHomeCodes.delete(code); else hiddenHomeCodes.add(code);
        const kind = TENNIS_ATHLETES[code] ? 'tennis' : (HOME_CRICKET_CODES.includes(code) ? 'backend' : 'espn');
        refreshAfterChange(kind);
      });
    });

    container.querySelectorAll('.filter-select-all').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const league = cb.dataset.league;
        const turnOn = e.target.checked;
        let kind = null;
        for (const t of (groups[league] ? groups[league].rivals : [])) {
          kind = t.kind;
          applyRivalChange({ kind: t.kind, code: t.code, id: t.id, league: t.league, name: t.name }, turnOn);
        }
        refreshAfterChange(kind === 'espn' ? 'espn' : 'tennis');
      });
    });

    const searchInput = container.querySelector('#tennisSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        tennisSearchQuery = e.target.value;
        renderFilterTeams();
      });
    }
  }

export function updateFilterBtnActiveState() {
    const btn = document.getElementById('filterBtn');
    if (!btn) return;
    const anyActive = extraEspnTeamCodes.size > 0 || extraTennisPlayers.size > 0 || hiddenHomeCodes.size > 0
      || hiddenExtraEspnCodes.size > 0 || hiddenExtraTennisKeys.size > 0;
    btn.classList.toggle('active', anyActive);
  }
