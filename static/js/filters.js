/**
 * Team-filter panel: which rival teams/players (beyond the always-tracked
 * roster in teams.js) the user has switched on, persisted to
 * localStorage, plus the panel's own DOM rendering.
 *
 * Owns extraEspnTeamCodes/extraTennisPlayers/tennisPlayerCatalog — the
 * only module that reassigns them — so other modules read them via the
 * exported functions/getters below rather than importing the bindings
 * directly.
 *
 * main.js supplies the two callbacks below once, at startup, so a
 * checkbox toggle here can trigger the right kind of refresh (a new ESPN
 * fetch vs. a zero-network tennis reclassify) without filters.js needing
 * to import the fetch pipeline itself.
 */

import { ESPN_TEAMS, TENNIS_ATHLETES, EXTRA_TEAM_CATALOG, EXTRA_TENNIS_CATALOG } from './teams.js';

let _onEspnChange = () => {};
let _onTennisChange = () => {};

export function initFilterCallbacks(onEspnChange, onTennisChange) {
  _onEspnChange = onEspnChange;
  _onTennisChange = onTennisChange;
}

export function getExtraTennisPlayers() {
  return extraTennisPlayers;
}

export function setTennisPlayerCatalog(league, map) {
  tennisPlayerCatalog[league] = map;
}

  // ---- Team filter state ----
  let extraEspnTeamCodes = new Set();
  let extraTennisPlayers = new Map();
  // league -> Map(athleteId -> displayName), every player seen in the last
  // tour fetch — this is what populates the tennis section of the filter
  // panel with zero extra API calls.
  let tennisPlayerCatalog = { atp: new Map(), wta: new Map() };

export function loadFilterSelections() {
    try {
      const codes = JSON.parse(localStorage.getItem('homecourt-extra-teams') || '[]');
      extraEspnTeamCodes = new Set(codes.filter(c => EXTRA_TEAM_CATALOG[c]));
    } catch (e) { extraEspnTeamCodes = new Set(); }
    try {
      const players = JSON.parse(localStorage.getItem('homecourt-extra-tennis') || '[]');
      extraTennisPlayers = new Map(players.map(p => [`${p.league}:${p.id}`, p]));
    } catch (e) { extraTennisPlayers = new Map(); }
  }

export function saveFilterSelections() {
    try {
      localStorage.setItem('homecourt-extra-teams', JSON.stringify([...extraEspnTeamCodes]));
      localStorage.setItem('homecourt-extra-tennis', JSON.stringify([...extraTennisPlayers.values()]));
    } catch (e) { /* localStorage unavailable — selections just won't persist across reloads */ }
  }

  loadFilterSelections();

  // Merges the always-on tracked teams with whichever extras are currently
  // checked — this IS the fetch list, so checking a box here is what
  // actually triggers loadEspnTeamsData to hit that team's schedule.
export function buildActiveEspnTeams() {
    const active = { ...ESPN_TEAMS };
    for (const code of extraEspnTeamCodes) {
      const entry = EXTRA_TEAM_CATALOG[code];
      if (entry) active[code] = entry.espn;
    }
    return active;
  }

  // Same idea for tennis, but this never changes what gets fetched — only
  // which of the already-fetched tour's players get classified/rendered.
export function buildActiveTennisAthletes() {
    const active = { ...TENNIS_ATHLETES };
    for (const [key, p] of extraTennisPlayers) {
      active[`EX_${key}`] = { sport: 'tennis', league: p.league, id: p.id, displayName: p.displayName };
    }
    return active;
  }

export function renderFilterTeams() {
    const container = document.getElementById('filterTeams');
    if (!container) return;
    const groups = {};

    for (const [code, entry] of Object.entries(EXTRA_TEAM_CATALOG)) {
      (groups[entry.league] ||= []).push({ kind: 'espn', code, name: entry.name, checked: extraEspnTeamCodes.has(code) });
    }

    // Tennis competitors: the named catalog (always selectable, even for a
    // player with no match in the currently-fetched tour window) merged
    // with whoever the last tour fetch actually saw play (which may include
    // players outside the named catalog too — that's still worth surfacing,
    // and its displayName — pulled live from ESPN — wins over the catalog's
    // when both know the same id).
    const trackedIds = new Set(Object.values(TENNIS_ATHLETES).map(a => String(a.id)));
    for (const league of ['atp', 'wta']) {
      const merged = new Map(); // id -> displayName
      for (const entry of Object.values(EXTRA_TENNIS_CATALOG)) {
        if (entry.league === league) merged.set(entry.id, entry.name);
      }
      for (const [id, displayName] of (tennisPlayerCatalog[league] || new Map())) {
        merged.set(id, displayName);
      }
      for (const [id, displayName] of merged) {
        if (trackedIds.has(id)) continue;
        const key = `${league}:${id}`;
        (groups[league.toUpperCase()] ||= []).push({
          kind: 'tennis', code: key, league, id, name: displayName, checked: extraTennisPlayers.has(key),
        });
      }
    }

    const leagueOrder = ['MLB', 'NBA', 'EPL', 'ATP', 'WTA'];
    const orderedLeagues = [...leagueOrder, ...Object.keys(groups).filter(l => !leagueOrder.includes(l))]
      .filter(league => groups[league] && groups[league].length);

    if (!orderedLeagues.length) {
      container.innerHTML = '<div class="filter-empty">No other teams available yet.</div>';
      return;
    }

    container.innerHTML = orderedLeagues.map(league => {
      const items = groups[league].sort((a, b) => a.name.localeCompare(b.name));
      const allChecked = items.every(t => t.checked);
      return `
      <div class="filter-league-group">
        <label class="filter-league-header">
          <span class="filter-league-title">${league}</span>
          <input type="checkbox" class="toggle-input filter-select-all" data-league="${league}" ${allChecked ? 'checked' : ''} aria-label="Select all ${league} competitors">
        </label>
        ${items.map(t => `
          <label class="filter-team-row" data-kind="${t.kind}" data-code="${t.code}" data-league="${t.league || ''}" data-id="${t.id || ''}" data-name="${t.name.replace(/"/g, '&quot;')}">
            <span class="name"><span>${t.name}</span></span>
            <input type="checkbox" class="toggle-input" ${t.checked ? 'checked' : ''}>
          </label>`).join('')}
      </div>`;
    }).join('');

    function applyRowChange(row, checked) {
      if (row.dataset.kind === 'espn') {
        if (checked) extraEspnTeamCodes.add(row.dataset.code); else extraEspnTeamCodes.delete(row.dataset.code);
      } else {
        const key = row.dataset.code;
        if (checked) extraTennisPlayers.set(key, { id: row.dataset.id, league: row.dataset.league, displayName: row.dataset.name });
        else extraTennisPlayers.delete(key);
      }
    }

    container.querySelectorAll('.filter-team-row').forEach(row => {
      const input = row.querySelector('input');
      input.addEventListener('change', (e) => {
        applyRowChange(row, e.target.checked);
        saveFilterSelections();
        updateFilterBtnActiveState();
        renderFilterTeams();
        if (row.dataset.kind === 'espn') _onEspnChange(); else _onTennisChange();
      });
    });

    // Sport-level "select all" — checks/unchecks every row within that
    // league group at once. A group is always all-espn or all-tennis (the
    // two catalogs never share a league name), so one flag per click is
    // enough to know which refresh to fire afterward.
    container.querySelectorAll('.filter-select-all').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const league = cb.dataset.league;
        const turnOn = e.target.checked;
        let kind = null;
        for (const t of (groups[league] || [])) {
          kind = t.kind;
          const row = { dataset: { kind: t.kind, code: t.code, id: t.id, league: t.league, name: t.name } };
          applyRowChange(row, turnOn);
        }
        saveFilterSelections();
        updateFilterBtnActiveState();
        renderFilterTeams();
        if (kind === 'espn') _onEspnChange(); else if (kind === 'tennis') _onTennisChange();
      });
    });
  }

export function updateFilterBtnActiveState() {
    const btn = document.getElementById('filterBtn');
    if (!btn) return;
    const anyActive = extraEspnTeamCodes.size > 0 || extraTennisPlayers.size > 0;
    btn.classList.toggle('active', anyActive);
  }
