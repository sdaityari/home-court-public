/**
 * DOM rendering — the live/upcoming/recent sections, the e-ink mini view,
 * and the footer status line. Owns the two pieces of view state that
 * drive what gets shown: currentData (the merged, already-classified
 * games) and showFullSchedule (the "Show Full Schedule" toggle).
 *
 * main.js is the only caller: it computes a fresh data set from the
 * fetch pipeline and hands it to applyData(), and forwards the schedule
 * toggle's change event to setShowFullSchedule().
 */

import { TEAMS, SPORT_ICONS, EXTRA_TEAM_CATALOG } from './teams.js';
import { parseDate, dayGroupLabel, groupByDay, formatTimeOnlyClient, formatShortDate } from './utils.js';
import { tennisLeagueLabel, followedTeamLabel } from './tennis.js';
import { getExtraTennisPlayers } from './filters.js';

const liveSection = document.getElementById('liveSection');
const liveGrid = document.getElementById('liveGrid');
const upcomingPanel = document.getElementById('upcomingPanel');
const recentPanel = document.getElementById('recentPanel');
const footerStatus = document.getElementById('footerStatus');

let currentData = { live: [], upcoming: [], recent: [], updated_at: null };
let showFullSchedule = false;

// Called by main.js's "Show Full Schedule" toggle handler — re-renders the
// two sections it affects without needing to know anything about
// currentData itself.
export function setShowFullSchedule(value) {
  showFullSchedule = value;
  renderUpcoming(currentData.upcoming);
  renderRecent(currentData.recent);
}

// Called by main.js's mergeAndRender once it has recombined the backend +
// ESPN + tennis pieces. Keeps the same "fall back to the previous
// updated_at" behavior the original inline mergeAndRender had, since that
// read needs to happen before currentData is overwritten.
export function applyData(newData) {
  currentData = {
    updated_at: newData.updated_at || currentData.updated_at || new Date().toISOString(),
    live: newData.live,
    upcoming: newData.upcoming,
    recent: newData.recent,
  };
  renderLive(currentData.live);
  renderUpcoming(currentData.upcoming);
  renderRecent(currentData.recent);
  renderMini();
  refreshFooterText();
}

export function teamOf(code) {
    if (TEAMS[code]) return TEAMS[code];
    if (EXTRA_TEAM_CATALOG[code]) return EXTRA_TEAM_CATALOG[code];
    if (code.startsWith('EX_')) {
      const p = getExtraTennisPlayers().get(code.slice(3)); // strip "EX_" -> "league:id"
      if (p) {
        const initials = p.displayName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
        return { name: p.displayName, league: p.league.toUpperCase(), color: "#D7E08A", sport: "tennis",
                 logo: `https://a.espncdn.com/i/headshots/tennis/players/full/${p.id}.png`, initials };
      }
    }
    return { name: code, league: "", color: "#7C8393", sport: null, logo: null, initials: code.slice(0,3) };
  }


export function badgeHtml(t, size) {
    if (t.logo) {
      return `<img class="team-badge" src="${t.logo}" alt="" width="${size}" height="${size}"
                onerror="this.outerHTML='<span class=&quot;team-badge fallback&quot; style=&quot;--accent-color:${t.color}&quot;>${t.initials}</span>'">`;
    }
    return `<span class="team-badge fallback" style="--accent-color:${t.color}">${t.initials}</span>`;
  }

export function iconHtml(sport) { return SPORT_ICONS[sport] || ''; }

export function getCricketMatchLink(teamCode, opponent, dateInput) {
    const teamName = teamCode === 'KKR' ? 'Kolkata Knight Riders' : teamOf(teamCode).name;
    const dateStr = dateInput ? formatShortDate(dateInput) : '';
    const query = encodeURIComponent(`${teamName} vs ${opponent}${dateStr ? ' ' + dateStr : ''}`);
    return `https://www.google.com/search?q=${query}`;
  }

export function matchLinkHtml(url, label = "Match Link", extraStyle = "") {
    if (!url) return '';
    const style = extraStyle ? ` style="${extraStyle}"` : '';
    return `<a class="highlight-link" href="${url}" target="_blank" rel="noopener" aria-label="${label}" title="${label}"${style}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>`;
  }

export function filterGames(games) {
    if (showFullSchedule) return games;

    // Default view: show one item per tracked team first, then fill the
    // remaining slots from other teams so the dashboard still shows at
    // least five fixtures/results when some tracked teams are out of season.
    const minimumVisible = 5;
    const seenTeams = new Set();
    const filtered = [];

    for (const g of games) {
      if (!seenTeams.has(g.team)) {
        seenTeams.add(g.team);
        filtered.push(g);
      }
    }

    if (filtered.length < minimumVisible) {
      const selected = new Set(filtered);
      for (const g of games) {
        if (!selected.has(g)) {
          filtered.push(g);
          selected.add(g);
          if (filtered.length >= minimumVisible) break;
        }
      }
    }

    return filtered;
  }

export function renderLive(games) {
    if (!games.length) {
      liveSection.style.display = 'none';
      liveGrid.innerHTML = '';
      return;
    }
    liveSection.style.display = '';
    liveGrid.innerHTML = games.map(g => {
      const t = teamOf(g.team);
      const isTennis = t.sport === 'tennis';
      const isScoreLine = t.sport === 'baseball' || t.sport === 'soccer' || t.sport === 'basketball';
      const isCricket = t.sport === 'cricket' || g.team.startsWith('IND') || g.team === 'KKR';
      const linkUrl = g.url || (isCricket ? getCricketMatchLink(g.team, g.opponent, new Date()) : null);
      const linkText = isCricket ? 'BCCI Match' : 'Link';
      // Tennis scores are a single set-by-set line (e.g. "4–6, 6–2, 6–7")
      // shared between both players, not a separate running number per
      // player — so it gets one combined row instead of the usual two
      // stacked team/opponent score rows. Baseball/soccer/basketball get
      // their own single-line "Team 4 – 2 Opponent" format for the same
      // reason: one row reads more naturally than a follow-team-first
      // stack once there's just a single final number per side. Cricket
      // keeps the stacked default — its score is a longer innings summary,
      // not a bare number, so it needs the extra row.
      const teamLinesHtml = isTennis ? `
          <div class="team-line followed">
            <span class="name">${badgeHtml(t, 22)}${followedTeamLabel(t, g)} <span style="font-weight:400;opacity:.7;">vs</span> ${g.opponent}</span>
            <span class="score">${g.teamScore}</span>
          </div>` : isScoreLine ? `
          <div class="team-line followed">
            <span class="name">${badgeHtml(t, 22)}${t.name} <span class="score-inline">${g.teamScore} \u2013 ${g.oppScore}</span> ${g.opponent}</span>
          </div>` : `
          <div class="team-line followed">
            <span class="name">${badgeHtml(t, 22)}${t.name}</span>
            <span class="score">${g.teamScore}</span>
          </div>
          <div class="team-line">
            <span class="name">${g.opponent}</span>
            <span class="score">${g.oppScore}</span>
          </div>`;
      return `
        <div class="live-card" style="--accent-color:${t.color}">
          <div class="meta-row">
            <span class="league-tag">${iconHtml(t.sport)}${tennisLeagueLabel(g, t)}</span>
            <span class="status">● ${g.status}</span>
          </div>${teamLinesHtml}
          ${(g.watch || linkUrl) ? `
          <div class="watch-row">
            ${g.watch ? `<span class="watch-label">Watch on</span><span class="watch-source">${g.watch}</span>` : '<span></span>'}
            ${matchLinkHtml(linkUrl, linkText, 'margin-left:auto;')}
          </div>` : ''}
        </div>`;
    }).join('');
  }

export function emptyRow(message) {
    return `<div class="row" style="grid-template-columns: 1fr;">
      <span class="side-info" style="color:var(--text-faint);">${message}</span>
    </div>`;
  }

export function renderUpcoming(games) {
    const sortedGames = [...games].sort((a, b) => new Date(a.rawWhen || a.when) - new Date(b.rawWhen || b.when));
    const gamesToRender = filterGames(sortedGames);

    if (!gamesToRender.length) {
      upcomingPanel.innerHTML = emptyRow('Nothing scheduled');
      return;
    }

    upcomingPanel.innerHTML = groupByDay(gamesToRender).map(group => `
      <div class="day-group">
        <div class="day-group-header">${group.label}</div>
        ${group.items.map(g => {
          const t = teamOf(g.team);
          const isCricket = t.sport === 'cricket' || g.team.startsWith('IND') || g.team === 'KKR';
          const linkUrl = g.url || (isCricket ? getCricketMatchLink(g.team, g.opponent, g.rawWhen) : null);
          const linkText = isCricket ? 'BCCI Match' : 'Match Link';
          return `
          <div class="row row-upcoming">
            <div class="stripe" style="--accent-color:${t.color}"></div>
            <span class="league-tag" style="--accent-color:${t.color}">${iconHtml(t.sport)}${t.league}</span>
            <span class="matchup-text">
              <span class="matchup-main">${badgeHtml(t, 18)}${followedTeamLabel(t, g)}<span class="vs">vs</span><span class="opponent-name">${g.opponent}</span></span>
              ${g.competition ? `<span class="competition-subtitle">${g.competition}</span>` : ''}
            </span>
            <span class="side-info">${formatTimeOnlyClient(g.rawWhen || g.when)}${matchLinkHtml(linkUrl, linkText)}</span>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

export function renderRecent(games) {
    const sortedGames = [...games].sort((a, b) => new Date(b.rawWhen || b.when) - new Date(a.rawWhen || a.when));
    const gamesToRender = filterGames(sortedGames);

    if (!gamesToRender.length) {
      recentPanel.innerHTML = emptyRow('No recent results');
      return;
    }

    recentPanel.innerHTML = groupByDay(gamesToRender).map(group => `
      <div class="day-group">
        <div class="day-group-header">${group.label}</div>
        ${group.items.map(g => {
          const t = teamOf(g.team);
          const isCricket = t.sport === 'cricket' || g.team.startsWith('IND') || g.team === 'KKR';
          const linkUrl = g.url || (isCricket ? getCricketMatchLink(g.team, g.opponent, g.rawWhen) : null);
          const linkText = isCricket ? 'BCCI Match' : 'Match Link';
          return `
          <div class="row row-recent">
            <div class="stripe" style="--accent-color:${t.color}"></div>
            <span class="league-tag" style="--accent-color:${t.color}">${iconHtml(t.sport)}${t.league}</span>
            <span class="matchup-text">
              <span class="matchup-main">${badgeHtml(t, 18)}${followedTeamLabel(t, g)}<span class="vs">vs</span><span class="opponent-name">${g.opponent}</span></span>
              ${g.competition ? `<span class="competition-subtitle">${g.competition}</span>` : ''}
            </span>
            <span class="side-info">
              <span class="result-badge ${g.result}">${g.line}</span>
              <a class="highlight-link" href="${g.highlight}" target="_blank" rel="noopener" aria-label="Highlights" title="Highlights">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </a>
              ${matchLinkHtml(linkUrl, linkText)}
            </span>
          </div>`;
        }).join('')}
      </div>`).join('');
  }

export function renderMiniLive(games) {
    const el = document.getElementById('miniLive');
    const capped = games.slice(0, 3);
    if (!capped.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="mini-live-label">Live now</div>` + capped.map(g => {
      const t = teamOf(g.team);
      const isTennis = t.sport === 'tennis';
      const isScoreLine = t.sport === 'baseball' || t.sport === 'soccer' || t.sport === 'basketball';
      // Tennis has one shared set-by-set line rather than a separate
      // number per player, so show "Player vs Opponent" with the score
      // line where the live status text normally goes. Baseball/soccer/
      // basketball use the same "Team 4 – 2 Opponent" order as the desktop
      // view (see renderLive) rather than the default "Team score –
      // opponent score" layout cricket still uses.
      const matchup = isTennis
        ? `${followedTeamLabel(t, g)} <span class="mini-vs">vs</span> ${g.opponent}`
        : isScoreLine
        ? `${t.name} ${g.teamScore}<span class="mini-vs">\u2013</span>${g.oppScore} ${g.opponent}`
        : `${t.name} ${g.teamScore}<span class="mini-vs">\u2013</span>${g.opponent} ${g.oppScore}`;
      const rightSide = isTennis ? g.teamScore : g.status;
      return `<div class="mini-live-row">
        <span class="mini-matchup">${matchup}</span>
        <span class="mini-live-status">${rightSide}</span>
      </div>`;
    }).join('');
  }

export function renderMiniList(containerId, games, emptyMessage, sideFn, maxItems = 5) {
    const el = document.getElementById(containerId);
    if (maxItems <= 0) { el.innerHTML = ''; return; } // no room left, not "genuinely empty" — show nothing, not the empty-message
    const capped = games.slice(0, maxItems);
    if (!capped.length) { el.innerHTML = `<div class="mini-empty">${emptyMessage}</div>`; return; }
    el.innerHTML = capped.map(g => {
      const t = teamOf(g.team);
      return `<div class="mini-row">
        <span class="mini-matchup">${followedTeamLabel(t, g)}<span class="mini-vs">vs</span>${g.opponent}</span>
        <span class="mini-side">${sideFn(g)}</span>
      </div>`;
    }).join('');
  }

export function renderMini() {
    const updatedEl = document.getElementById('miniUpdated');
    if (updatedEl) updatedEl.textContent = formatUpdatedAtAbsolute(currentData.updated_at);
    renderMiniLive(currentData.live);
    renderMiniList('miniUpcoming', currentData.upcoming, 'Nothing scheduled',
      g => `${dayGroupLabel(parseDate(g.rawWhen || g.when))} ${formatTimeOnlyClient(g.rawWhen || g.when)}`);
    // Each live row eats into the fixed 600px canvas — past 2 live games,
    // drop a Results row per extra live game so everything still fits
    // without clipping (Upcoming stays flat at 5; only Results adapts).
    // renderMiniLive itself never shows more than 3 live rows, so this
    // only ever needs to trim Results down to 4 in practice — capped here
    // the same way so the two stay in sync if that display cap ever changes.
    const shownLiveCount = Math.min(currentData.live.length, 3);
    const recentCap = Math.max(0, 5 - Math.max(0, shownLiveCount - 2));
    renderMiniList('miniRecent', currentData.recent, 'No recent results', g => g.line, recentCap);
  }

export function formatUpdatedAt(iso) {
    if (!iso) return 'UPDATING\u2026';
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'UPDATED JUST NOW';
    if (mins === 1) return 'UPDATED 1 MIN AGO';
    return `UPDATED ${mins} MIN AGO`;
  }

  // Used for the kiosk/e-ink view specifically, instead of formatUpdatedAt's
  // relative "3 MIN AGO" phrasing — that's only meaningful on a screen
  // being actively watched in real time. A TRMNL/e-ink frame shows a
  // periodic screenshot: by the time someone looks at the physical Kindle,
  // "just now" could actually mean anywhere from minutes to hours ago,
  // since the e-ink panel itself only redraws occasionally. An absolute
  // timestamp stays accurate and meaningful no matter when it's read.
export function formatUpdatedAtAbsolute(iso) {
    if (!iso) return 'UPDATING\u2026';
    const dt = new Date(iso);
    const datePart = dt.toLocaleString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const timePart = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `UPDATED ${datePart} \u00b7 ${timePart}`;
  }

export function refreshFooterText() {
    footerStatus.textContent = `${formatUpdatedAt(currentData.updated_at)} \u00b7 AUTO-REFRESH EVERY 15 MIN`;
    const miniUpdatedEl = document.getElementById('miniUpdated');
    if (miniUpdatedEl) miniUpdatedEl.textContent = formatUpdatedAtAbsolute(currentData.updated_at);
  }
