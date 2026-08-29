/**
 * Tennis-specific parsing and classification.
 *
 * ESPN's tennis feed shape differs enough from the team-sport feeds
 * (singles vs. doubles competitors, nested events/groupings, tournament
 * naming spread across several possible fields) that it gets its own
 * module rather than sharing espn.js's classify function.
 */

import { parseDate, formatWhenClient, extractScoreValue, pickEspnLink, fetchWithTimeout, normalizeTennisName } from './utils.js';

  // Doubles/mixed-doubles competitors carry a plural `athletes` array (two
  // players) instead of the singular `athlete` singles use — ESPN's shape,
  // not this app's invention. Everything below treats `.athletes` as the
  // doubles case and falls back to singular `.athlete` for singles, so a
  // single set of helpers covers both without a separate doubles code path.
export function tennisCompetitorAthletes(competitor) {
    if (!competitor) return [];
    if (Array.isArray(competitor.athletes) && competitor.athletes.length) return competitor.athletes;
    if (competitor.athlete) return [competitor.athlete];
    return [];
  }

export function tennisCompetitorNames(competitor) {
    const names = [];
    for (const athlete of tennisCompetitorAthletes(competitor)) {
      names.push(athlete.displayName, athlete.fullName, athlete.shortName, athlete.lastName);
    }
    if (competitor && competitor.team) {
      names.push(competitor.team.displayName, competitor.team.name,
                 competitor.team.shortDisplayName, competitor.team.abbreviation);
    }
    if (competitor && competitor.roster) {
      names.push(competitor.roster.displayName, competitor.roster.fullName);
    }
    return names.filter(Boolean);
  }

export function tennisAthleteMatches(athlete, cfg) {
    if (!athlete) return false;
    const ids = [athlete.id, athlete.uid].filter(v => v != null).map(String);
    if (ids.includes(String(cfg.id))) return true;
    const target = normalizeTennisName(cfg.displayName);
    for (const name of [athlete.displayName, athlete.fullName, athlete.shortName, athlete.lastName].filter(Boolean)) {
      const normalized = normalizeTennisName(name);
      if (normalized === target || normalized.includes(target) || target.includes(normalized)) return true;
    }
    return false;
  }

export function tennisCompetitorMatches(competitor, cfg) {
    if (!competitor) return false;
    const ids = [competitor.id, competitor.team && competitor.team.id].filter(v => v != null).map(String);
    if (ids.includes(String(cfg.id))) return true;
    if (tennisCompetitorAthletes(competitor).some(a => tennisAthleteMatches(a, cfg))) return true;

    const target = normalizeTennisName(cfg.displayName);
    return tennisCompetitorNames(competitor).some(name => {
      const normalized = normalizeTennisName(name);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
  }

  // Splits a "Player A / Player B" (or "Player A/Player B") combined
  // doubles-team name into its two names. Tolerant of whether the feed
  // padded the slash with spaces — upcoming and completed/results events
  // haven't been consistent about that, which is what silently broke the
  // results-side partner lookup below despite upcoming working fine.
  // Returns null for anything that isn't a clean two-way split (singles
  // names, or a name that happens to contain an unrelated "/").
export function splitDoublesName(name) {
    if (!name) return null;
    const halves = String(name).split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
    return halves.length === 2 ? halves : null;
  }

  // Our tracked player's doubles/mixed-doubles partner — the OTHER athlete
  // on the same side as the matched player. null for a singles competitor,
  // so callers can use presence of a partner name as the doubles/mixed-
  // doubles signal itself rather than checking match type separately.
  //
  // Primary path: the competitor's own `.athletes` pair, when the feed
  // shape includes it. Fallback: some ESPN tennis feed shapes only give
  // OUR side a singular `.athlete` (no plural `.athletes` array), while
  // still exposing a combined "Player A / Player B" name somewhere in the
  // competitor's team/roster fields — the exact field
  // tennisCompetitorDisplayName already reads to get the OPPONENT's full
  // pairing correctly. Reading that same combined name for our own side
  // and pulling out whichever half isn't the tracked player covers that
  // shape too, so the partner shows up regardless of which shape (or
  // event state — upcoming vs. completed) a given event uses.
export function tennisPartnerName(competitor, cfg) {
    const athletes = tennisCompetitorAthletes(competitor);
    if (athletes.length >= 2) {
      const partner = athletes.find(a => !tennisAthleteMatches(a, cfg));
      if (partner) return partner.displayName || partner.fullName || partner.shortName;
    }

    const combined = tennisCompetitorNames(competitor).map(splitDoublesName).find(Boolean);
    if (!combined) return null;
    const target = normalizeTennisName(cfg.displayName);
    const other = combined.find(name => {
      const normalized = normalizeTennisName(name);
      return normalized !== target && !normalized.includes(target) && !target.includes(normalized);
    });
    return other || null;
  }

export function tennisCompetitorDisplayName(competitor) {
    const names = tennisCompetitorNames(competitor);
    const combined = names.find(name => splitDoublesName(name));
    return combined || names[0] || 'Opponent';
  }

  // Tournament/competition naming varies slightly across ESPN tennis feed
  // shapes. Prefer the explicit tournament object, then fall back to the
  // event/grouping name when it looks like a real competition name.
export function tennisCompetitionName(comp, eventContext, node) {
    const candidates = [
      comp && comp.tournament && comp.tournament.displayName,
      comp && comp.tournament && comp.tournament.name,
      comp && comp.event && comp.event.displayName,
      comp && comp.event && comp.event.name,
      comp && comp.series && comp.series.displayName,
      comp && comp.series && comp.series.name,
      comp && comp.type && comp.type.text,
      comp && comp.notes && comp.notes[0] && comp.notes[0].headline,
      node && node.tournament && node.tournament.displayName,
      node && node.tournament && node.tournament.name,
      node && node.season && node.season.displayName,
      node && node.league && node.league.name,
      node && node.shortName,
      node && node.displayName,
      node && node.name,
      eventContext && eventContext.tournament && eventContext.tournament.displayName,
      eventContext && eventContext.tournament && eventContext.tournament.name,
      eventContext && eventContext.season && eventContext.season.displayName,
      eventContext && eventContext.league && eventContext.league.name,
      eventContext && eventContext.shortName,
      eventContext && eventContext.displayName,
      eventContext && eventContext.name,
    ];

    for (const value of candidates) {
      const name = String(value || '').trim();
      if (!name) continue;
      if (/^(ATP|WTA|Tennis|Men\'s Singles|Women\'s Singles)$/i.test(name)) continue;
      return name;
    }
    return null;
  }

export function tennisLeagueLabel(game, team) {
    return game && game.competition ? `${team.league} · ${game.competition}` : team.league;
  }

  // Followed-player label for the score cards — appends the doubles/mixed-
  // doubles partner ("Player / Partner") when the game carries one, since
  // otherwise a doubles result reads like an (incorrect) singles one. Uses
  // "/" rather than "&" to match how the opponent side already formats a
  // pairing (tennisCompetitorDisplayName). Non-tennis games and tennis
  // singles just get the plain team name back.
export function followedTeamLabel(t, g) {
    return g && g.partner ? `${t.name} / ${g.partner}` : t.name;
  }

  // ESPN's tennis round info (e.g. "Round of 16", "Quarterfinal", "Final")
  // sits on the competition's `round` object when the feed includes one —
  // but like the tournament name above, it's not consistent about which
  // node carries it, so the same three levels get checked.
export function tennisRoundName(comp, eventContext, node) {
    const candidates = [
      comp && comp.round && comp.round.displayName,
      comp && comp.round && comp.round.name,
      comp && comp.round && comp.round.type && comp.round.type.text,
      node && node.round && node.round.displayName,
      node && node.round && node.round.name,
      eventContext && eventContext.round && eventContext.round.displayName,
      eventContext && eventContext.round && eventContext.round.name,
    ];
    for (const value of candidates) {
      const name = String(value || '').trim();
      if (name) return name;
    }
    return null;
  }

export function tennisFullCompetitionName(comp, eventContext, node) {
    const tourney = tennisCompetitionName(comp, eventContext, node);
    const round = tennisRoundName(comp, eventContext, node);
    if (tourney && round) return `${tourney} \u00b7 ${round}`;
    return tourney || round;
  }

  // ESPN's tennis feed is not guaranteed to use the same hierarchy as team
  // sports. Depending on tournament/feed version, matches can appear as:
  // events[].competitions[] or events[].groupings[].competitions[]. Flatten
  // every object containing a real competition with competitors so the rest
  // of the dashboard can work with one consistent event shape.
export function flattenTennisEvents(body) {
    const out = [];
    const seen = new Set();

    function walk(node, parentEvent) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(item => walk(item, parentEvent));
        return;
      }

      const eventContext = node.id && (node.date || node.name || node.links)
        ? node : parentEvent;

      if (Array.isArray(node.competitions)) {
        for (const comp of node.competitions) {
          if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) continue;
          const key = String(comp.id || `${eventContext && eventContext.id || ''}|${comp.date || ''}|${JSON.stringify(comp.competitors.map(c => c.id || c.athlete?.id || c.athlete?.displayName))}`);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            ...(eventContext || {}),
            ...node,
            id: (eventContext && eventContext.id) || node.id || comp.id,
            date: comp.date || node.date || (eventContext && eventContext.date),
            competitions: [comp],
            competitionName: tennisFullCompetitionName(comp, eventContext, node),
          });
        }
      }

      for (const [key, value] of Object.entries(node)) {
        if (key === 'competitions') continue;
        if (value && typeof value === 'object') walk(value, eventContext);
      }
    }

    walk(body, null);
    return out;
  }

export function tennisSetScores(competitor) {
    const sets = competitor && Array.isArray(competitor.linescores) ? competitor.linescores : [];
    return sets.map(set => {
      if (set == null) return '';
      if (typeof set === 'object') {
        const value = set.displayValue ?? set.value ?? set.score;
        return value == null ? '' : String(value);
      }
      return String(set);
    }).filter(Boolean);
  }

export function tennisMatchLine(us, them) {
    const usSets = tennisSetScores(us);
    const themSets = tennisSetScores(them);
    if (usSets.length && themSets.length) {
      const n = Math.min(usSets.length, themSets.length);
      const sets = [];
      for (let i = 0; i < n; i++) sets.push(`${usSets[i]}–${themSets[i]}`);
      return sets.join(', ');
    }
    const usScore = extractScoreValue(us && us.score);
    const themScore = extractScoreValue(them && them.score);
    return `${Math.trunc(usScore)}–${Math.trunc(themScore)}`;
  }

export function tennisResult(us, them) {
    const usWinner = us && (us.winner === true || us.winner === 'true');
    const themWinner = them && (them.winner === true || them.winner === 'true');
    if (usWinner && !themWinner) return { result: 'win', prefix: 'W' };
    if (themWinner && !usWinner) return { result: 'loss', prefix: 'L' };

    const usSets = tennisSetScores(us).map(Number).filter(Number.isFinite);
    const themSets = tennisSetScores(them).map(Number).filter(Number.isFinite);
    if (usSets.length && themSets.length) {
      const usWon = usSets.reduce((n, v, i) => n + (v > (themSets[i] ?? -Infinity) ? 1 : 0), 0);
      const themWon = themSets.reduce((n, v, i) => n + (v > (usSets[i] ?? -Infinity) ? 1 : 0), 0);
      if (usWon > themWon) return { result: 'win', prefix: 'W' };
      if (themWon > usWon) return { result: 'loss', prefix: 'L' };
    }

    const usScore = extractScoreValue(us && us.score);
    const themScore = extractScoreValue(them && them.score);
    if (usScore > themScore) return { result: 'win', prefix: 'W' };
    if (usScore < themScore) return { result: 'loss', prefix: 'L' };
    return { result: 'draw', prefix: 'D' };
  }

export function classifyTennisEvents(events, code, cfg) {
    const live = [], upcoming = [], recent = [];
    for (const ev of events) {
      try {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp || !comp.status || !comp.status.type) continue;
        const competitors = comp.competitors || [];
        const us = competitors.find(c => tennisCompetitorMatches(c, cfg));
        if (!us) continue;
        const them = competitors.find(c => c !== us);
        if (!them) continue;

        const whenDt = parseDate(ev.date || comp.date || ev.startDate);
        const opponent = tennisCompetitorDisplayName(them);
        // null for singles — present only for doubles/mixed-doubles, where
        // it's our tracked player's partner on the same side of the net.
        const partner = tennisPartnerName(us, cfg);
        const state = comp.status.type.state;
        const watch = (comp.broadcasts && comp.broadcasts[0] && comp.broadcasts[0].names)
          ? comp.broadcasts[0].names.join('/') : null;
        const url = pickEspnLink(ev);
        const line = tennisMatchLine(us, them);
        const competition = ev.competitionName || tennisFullCompetitionName(comp, ev, ev);

        if (state === 'in') {
          live.push({
            team: code, opponent, partner,
            teamScore: line, oppScore: '',
            status: comp.status.type.shortDetail || 'Live',
            competition, watch, url, eventId: ev.id,
          });
        } else if (state === 'pre') {
          upcoming.push({ team: code, opponent, partner, rawWhen: whenDt,
            when: formatWhenClient(whenDt), competition, watch, url });
        } else if (state === 'post' && comp.status.type.completed) {
          const outcome = tennisResult(us, them);
          if (!competition) {
            console.warn(`Tennis competition name unresolved for a completed match (${code} vs ${opponent}) — raw event:`, ev);
          }
          recent.push({ team: code, opponent, partner, rawWhen: whenDt,
            when: formatWhenClient(whenDt), competition, result: outcome.result, url,
            line: `${outcome.prefix} ${line}` });
        }
      } catch (e) {
        console.warn(`Skipping malformed tennis event for ${code}:`, e, ev);
      }
    }
    upcoming.sort((a, b) => a.rawWhen - b.rawWhen);
    recent.sort((a, b) => b.rawWhen - a.rawWhen);
    return { live, upcoming, recent };
  }

export async function fetchTennisSchedule(league) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 45);
    const end = new Date(today);
    end.setDate(end.getDate() + 120);
    const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/${league}/scoreboard?dates=${fmt(start)}-${fmt(end)}&limit=1000`;
    const res = await fetchWithTimeout(url, 12000);
    if (!res || !res.ok) throw new Error(`Tennis HTTP ${res ? res.status : 'no response'}`);
    const body = await res.json();
    return flattenTennisEvents(body);
  }

  // league -> Map(athleteId -> displayName), every player seen in the last
  // tour fetch — this is what populates the tennis section of the filter
  // panel with zero extra API calls.
  let tennisPlayerCatalog = { atp: new Map(), wta: new Map() };

export function collectTennisPlayers(events) {
    const map = new Map();
    for (const ev of events) {
      const comp = ev.competitions && ev.competitions[0];
      const competitors = comp && comp.competitors;
      if (!Array.isArray(competitors)) continue;
      for (const c of competitors) {
        // athlete.id specifically — this is the same id space
        // tennisCompetitorMatches checks cfg.id against, so a filter
        // selection built from this id will actually match its own games.
        // Doubles-team competitors have no .athlete, so they're skipped —
        // keeps the filter to singles players only.
        const id = c.athlete && c.athlete.id != null ? String(c.athlete.id) : null;
        if (!id || map.has(id)) continue;
        const name = tennisCompetitorDisplayName(c);
        if (name && name !== 'Opponent') map.set(id, name);
      }
    }
    return map;
  }
