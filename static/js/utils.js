/**
 * Shared, dependency-free helpers: date parsing/formatting, network
 * fetch-with-timeout, score-value extraction, fixture de-duping, and the
 * highlight-link resolver. Used by nearly every other module.
 */

export function parseDate(val) {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    const dt = new Date(val);
    return Number.isNaN(dt.getTime()) ? new Date() : dt;
  }

export function formatWhenClient(dtInput) {
    const dt = parseDate(dtInput);
    const datePart = dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timePart = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} \u00b7 ${timePart}`;
  }

export async function fetchWithTimeout(url, ms, options) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

export function normalizeTennisName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // ---- Today / Tomorrow / Yesterday grouping (upcoming + recent) ----

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export function dayGroupLabel(dt) {
    const diffDays = Math.round((startOfDay(dt) - startOfDay(new Date())) / 86400000);
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'TOMORROW';
    if (diffDays === -1) return 'YESTERDAY';
    return dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  }

  // Games are already sorted chronologically before this runs, so entries
  // sharing a day-group label are always adjacent — a single pass is
  // enough, no separate bucket-then-reorder step needed.
export function groupByDay(games) {
    const groups = [];
    for (const g of games) {
      const label = dayGroupLabel(parseDate(g.rawWhen || g.when));
      const bucket = groups[groups.length - 1];
      if (bucket && bucket.label === label) {
        bucket.items.push(g);
      } else {
        groups.push({ label, items: [g] });
      }
    }
    return groups;
  }

export function formatTimeOnlyClient(dtInput) {
    return parseDate(dtInput).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // "Aug 15" — used for cricket search-link queries (getCricketMatchLink),
  // deliberately shorter than dayGroupLabel's "SUN, SEP 13" (no weekday,
  // no year): a search query reads better as "India vs Sri Lanka Aug 15"
  // than with a weekday or year tacked on.
export function formatShortDate(dtInput) {
    return parseDate(dtInput).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }

export function pickEspnLink(ev) {
    const links = ev.links || [];
    const found = links.find(l => Array.isArray(l.rel) && l.rel.includes('summary') && l.rel.includes('desktop'))
      || links.find(l => Array.isArray(l.rel) && l.rel.includes('summary'));
    return (found && found.href) || (links[0] && links[0].href) || null;
  }

export function dedupeFixtures(games) {
    const seen = new Set();
    const out = [];
    for (const g of games) {
      const dt = parseDate(g.rawWhen || g.when);
      const day = Number.isNaN(dt.getTime()) ? String(g.when) : dt.toISOString().slice(0, 10);
      const key = `${g.team || ''}|${day}|${(g.opponent || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
      if (!seen.has(key)) { seen.add(key); out.push(g); }
    }
    return out;
  }

export function extractScoreValue(score) {
    if (score == null) return 0;
    if (typeof score === 'object') {
      const raw = score.value ?? score.displayValue ?? 0;
      return parseFloat(raw) || 0;
    }
    return parseFloat(score) || 0;
  }

  // Best-effort tournament/round name for team-sport ESPN events (MLB/NBA/
  // soccer) — mirrors the tennis competition-name approach below, but more
  // conservative: soccer teams queried with leagues:["all"] (Chelsea) span
  // multiple competitions (Premier League, FA Cup, Champions League, etc),
  // not just the one named by the static league tag, so this is worth
  // showing whenever ESPN's response actually has it. Generic season-stage
  // labels ("Regular Season") are skipped since they'd just restate what
  // the league tag already shows, not add real information. Unverified
  // against a live sample for every league this app tracks — if a
  // particular sport's events never populate `notes[0].headline`, this
  // will just silently show nothing for it, the same safe fallback the
  // tennis version already relies on.
export function espnCompetitionName(ev, comp) {
    const candidates = [
      comp && comp.notes && comp.notes[0] && comp.notes[0].headline,
      ev && ev.season && ev.season.type && ev.season.type.name,
      ev && ev.league && ev.league.name,
    ];
    for (const value of candidates) {
      const name = String(value || '').trim();
      if (!name) continue;
      if (/^(Regular Season|Preseason|Postseason)$/i.test(name)) continue;
      return name;
    }
    return null;
  }

export function formatDateForSearch(dtInput) {
    const dt = parseDate(dtInput);
    if (!dt || Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

export async function attachHighlight(game, displayName) {
    const dateStr = formatDateForSearch(game.rawWhen || game.when);
    const suffix = dateStr ? ` ${dateStr}` : '';
    const fallback = `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName + ' vs ' + game.opponent + suffix + ' highlights')}`;
    try {
      const res = await fetchWithTimeout(
        `/api/highlight?team=${encodeURIComponent(displayName)}&opponent=${encodeURIComponent(game.opponent)}${dateStr ? '&when=' + encodeURIComponent(dateStr) : ''}`, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { team: game.team, opponent: game.opponent, partner: game.partner, rawWhen: game.rawWhen, when: game.when, result: game.result, line: game.line, url: game.url, competition: game.competition, highlight: data.url || fallback };
    } catch (e) {
      return { team: game.team, opponent: game.opponent, partner: game.partner, rawWhen: game.rawWhen, when: game.when, result: game.result, line: game.line, url: game.url, competition: game.competition, highlight: fallback };
    }
  }
