/**
 * ESPN fetch + classification for the team sports (MLB/NBA/EPL/WSL/NWSL).
 *
 * Fetched client-side deliberately: ESPN's public API blocks requests
 * from cloud/datacenter IPs (confirmed on this app's Render deployment),
 * so these calls run from the tablet's own browser, where the request
 * comes from a normal residential IP instead. See scores.py for the
 * backend-owned sources (cricket, Chelsea).
 */

import { parseDate, formatWhenClient, extractScoreValue, espnCompetitionName, pickEspnLink, fetchWithTimeout } from './utils.js';

export async function fetchEspnSchedule(cfg) {
    const results = await Promise.all(cfg.leagues.map(async (league) => {
      const urlPast = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${league}/teams/${cfg.team}/schedule?limit=30&fixture=false`;
      const urlUpcoming = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${league}/teams/${cfg.team}/schedule?limit=30&fixture=true`;
      
      const [resPast, resUpcoming] = await Promise.all([
        fetchWithTimeout(urlPast, 8000).catch(() => null),
        fetchWithTimeout(urlUpcoming, 8000).catch(() => null)
      ]);

      let events = [];
      let teamId = null;

      if (resPast && resPast.ok) {
        const bodyPast = await resPast.json();
        if (bodyPast.events) events.push(...bodyPast.events);
        if (bodyPast.team) teamId = bodyPast.team.id;
      }
      if (resUpcoming && resUpcoming.ok) {
        const bodyUpcoming = await resUpcoming.json();
        if (bodyUpcoming.events) events.push(...bodyUpcoming.events);
        if (bodyUpcoming.team) teamId = bodyUpcoming.team.id;
      }

      return { events, teamId };
    }));
    
    const seen = new Set();
    const events = [];
    let teamId = null;
    for (const r of results) {
      if (r.teamId) teamId = r.teamId;
      for (const ev of r.events) {
        if (!seen.has(ev.id)) { seen.add(ev.id); events.push(ev); }
      }
    }
    return { events, teamId };
  }

  // Live scores confirmed against real ESPN JSON (2026-08-22, NYY@TOR
  // 401816628): the team-schedule endpoint's own `score` field genuinely
  // has no key at all while a game is in progress — not "0", not null,
  // absent — so there is nothing to parse there for a live game. The
  // per-event summary endpoint DOES carry the real live score, confirmed
  // in the same check (header.competitions[0].competitors[].score was
  // "0"/"1", matching the real 1-0 game). This fetches that endpoint only
  // for events currently live, keyed by event id (globally unique, so no
  // need to key by sport/league too).
  const _summaryCache = {};
export async function fetchEventSummary(sport, league, eventId) {
    const key = `${sport}/${league}/${eventId}`;
    if (_summaryCache[key]) return _summaryCache[key];
    const promise = (async () => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
        const res = await fetchWithTimeout(url, 8000);
        if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'no response'}`);
        return await res.json();
      } catch (e) {
        console.warn(`Event summary fetch failed for ${sport}/${league}/${eventId}:`, e);
        return null;
      }
    })();
    _summaryCache[key] = promise;
    return promise;
  }

export function liveScoreFromSummary(summaryBody, teamId) {
    if (!summaryBody || !teamId) return null;
    const comp = (summaryBody.header && summaryBody.header.competitions && summaryBody.header.competitions[0])
      || (summaryBody.competitions && summaryBody.competitions[0]);
    const competitors = comp && comp.competitors;
    if (!Array.isArray(competitors) || competitors.length < 2) return null;
    const usC = competitors.find(c => String(c.id) === String(teamId) || (c.team && String(c.team.id) === String(teamId)));
    const themC = competitors.find(c => c !== usC);
    if (!usC || !themC) return null;
    return { usScore: extractScoreValue(usC.score), themScore: extractScoreValue(themC.score) };
  }

  // "all" (soccer teams spanning multiple competitions — see ESPN_TEAMS)
  // isn't a real league slug the summary endpoint accepts, and the
  // team-schedule response doesn't say which real competition a given
  // event actually belongs to — so there's no reliable league to build
  // that URL with for those teams. They keep the schedule-based estimate;
  // everything else (a single real league slug) gets the fix above.
export function pickSummaryLeague(cfg) {
    const real = cfg.leagues.find(l => l !== 'all');
    return real || null;
  }

export function classifyEspnEvents(events, code, cfg, teamId) {
    const live = [], upcoming = [], recent = [];
    for (const ev of events) {
      try {
        const comp = ev.competitions[0];
        if (!comp || !comp.status || !comp.status.type) continue;
        const state = comp.status.type.state; 
        const competitors = comp.competitors || [];
        const us = competitors.find(c =>
          (teamId && c.team.id === teamId) || (c.team.abbreviation || '').toUpperCase() === code.toUpperCase());
        if (!us) continue;
        const them = competitors.find(c => c !== us);
        if (!them) continue;

        const opponent = them.team.displayName || them.team.name || 'Opponent';
        const whenDt = parseDate(ev.date);
        const broadcasts = comp.broadcasts || [];
        const watch = (broadcasts.length && broadcasts[0].names && broadcasts[0].names.length)
          ? broadcasts[0].names.join('/') : null;
        const url = pickEspnLink(ev);
        const competition = espnCompetitionName(ev, comp);

        if (state === 'in') {
          // Schedule-based placeholder — patched below in classifyEspnEvents'
          // caller once the per-event summary fetch resolves, for any
          // team with a real league slug to fetch it with. Still run through
          // extractScoreValue even as a placeholder: for a delayed/not-yet-
          // started game, ESPN's schedule feed gives `score` as an object
          // (e.g. {value: 0, displayValue: "0"}) rather than a plain number,
          // and this branch is the one that's actually SHOWN for any team
          // whose summary-patch gets skipped (see pickSummaryLeague below) —
          // confirmed via a real Chelsea game rendering as "[object Object]"
          // before this was applied here specifically.
          live.push({
            team: code, opponent,
            teamScore: String(extractScoreValue(us.score)), oppScore: String(extractScoreValue(them.score)),
            status: comp.status.type.shortDetail || 'Live', watch, url,
            eventId: ev.id, competition,
          });
        } else if (state === 'pre') {
          upcoming.push({ team: code, opponent, rawWhen: whenDt, when: formatWhenClient(whenDt), watch, url, competition });
        } else if (state === 'post') {
          if (!comp.status.type.completed) continue;
          const usScore = extractScoreValue(us.score);
          const themScore = extractScoreValue(them.score);
          let result, prefix;
          if (usScore > themScore) { result = 'win'; prefix = 'W'; }
          else if (usScore < themScore) { result = 'loss'; prefix = 'L'; }
          else { result = 'draw'; prefix = 'D'; }
          recent.push({
            team: code, opponent, rawWhen: whenDt, when: formatWhenClient(whenDt), result, url, competition,
            line: `${prefix} ${Math.trunc(usScore)}\u2013${Math.trunc(themScore)}`,
          });
        }
      } catch (e) {
        console.warn(`Skipping malformed ESPN event for ${code}:`, e, ev);
      }
    }

    upcoming.sort((a, b) => a.rawWhen - b.rawWhen);
    recent.sort((a, b) => b.rawWhen - a.rawWhen);

    return { live, upcoming, recent };
  }
