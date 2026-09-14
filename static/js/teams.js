/**
 * Team, sport, and athlete registries — pure data, no DOM, no fetching.
 *
 * TEAMS/SPORT_ICONS/ESPN_TEAMS/TENNIS_ATHLETES are the always-tracked
 * roster this dashboard is built around. EXTRA_TEAM_CATALOG and
 * EXTRA_TENNIS_CATALOG are the selectable-but-off-by-default rivals shown
 * in the filter panel (see filters.js).
 */

  // ---- Team accent registry ----
export const TEAMS = {
    NYY: { name: "Yankees",       league: "MLB",  color: "#C4CED4", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", initials: "NYY" },
    NYK: { name: "Knicks",        league: "NBA",  color: "#F58426", sport: "basketball",
           logo: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png", initials: "NYK" },
    KKR: { name: "KKR",           league: "IPL",  color: "#D4AF37", sport: "cricket",
           logo: "https://www.kkr.in/static-assets/images/teams/1106.png", initials: "KKR" },
    CHE: { name: "Chelsea",       league: "EPL",  color: "#6CABDD", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/363.png", initials: "CHE" },
    CHEW:{ name: "Chelsea Women", league: "WSL",  color: "#6CABDD", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/363.png", initials: "CHW" },
    GFC: { name: "Gotham FC",      league: "NWSL", color: "#6CABDD", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/15364.png", initials: "GFC" },
    NYG: { name: "Giants",        league: "NFL",  color: "#0B2265", sport: "football",
           logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png", initials: "NYG" },
    INDM:{ name: "India",         league: "CRIC · MEN",   color: "#FF671F", sport: "cricket",
           logo: "https://www.bcci.tv/cms/images/gtykgr9m2ngt/1wee95mOUTwOptkwqVRYqW/ef7367850791aa565aa7fa5536260619/BCCI_Logo.svg", initials: "IND" },
    INDW:{ name: "India Women",   league: "CRIC · WOMEN", color: "#FF671F", sport: "cricket",
           logo: "https://www.bcci.tv/cms/images/gtykgr9m2ngt/1wee95mOUTwOptkwqVRYqW/ef7367850791aa565aa7fa5536260619/BCCI_Logo.svg", initials: "IW" },
    ALC: { name: "Carlos Alcaraz", league: "ATP", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3782.png", initials: "CA" },
    SIN: { name: "Jannik Sinner", league: "ATP", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3623.png", initials: "JS" },
    SAB: { name: "Aryna Sabalenka", league: "WTA", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3038.png", initials: "AS" },
    SWI: { name: "Iga Swiatek", league: "WTA", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3730.png", initials: "IS" },
    ANI: { name: "Amanda Anisimova", league: "WTA", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3221.png", initials: "AA" },
    RYB: { name: "Elena Rybakina", league: "WTA", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3126.png", initials: "ER" },
    AND: { name: "Mirra Andreeva", league: "WTA", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/9820.png", initials: "MA" },
    MED: { name: "Daniil Medvedev", league: "ATP", color: "#D7E08A", sport: "tennis",
           logo: "https://a.espncdn.com/i/headshots/tennis/players/full/3749.png", initials: "DM" },
  };

export const SPORT_ICONS = {
    baseball: `<svg class="sport-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M6.5 5.2c2.1 2.3 3.3 4.5 3.3 6.8s-1.2 4.5-3.3 6.8" fill="none" stroke="var(--panel)" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 5.2c-2.1 2.3-3.3 4.5-3.3 6.8s1.2 4.5 3.3 6.8" fill="none" stroke="var(--panel)" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    basketball: `<svg class="sport-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M2 12h20M12 2v20" stroke="var(--panel)" stroke-width="1.4" stroke-linecap="round"/><path d="M4.9 4.9c2.8 2.6 4.5 5.6 4.5 7.1s-1.7 4.5-4.5 7.1M19.1 4.9c-2.8 2.6-4.5 5.6-4.5 7.1s1.7 4.5 4.5 7.1" fill="none" stroke="var(--panel)" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    soccer: `<svg class="sport-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 6.8l3.9 2.8-1.5 4.6h-4.8L8.1 9.6 12 6.8z" fill="var(--panel)"/><path d="M12 6.8V3.5M15.9 9.6l3.1-1.7M14.4 14.2l1.7 3.8M9.6 14.2l-1.7 3.8M8.1 9.6L5 7.9" stroke="var(--panel)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    cricket: `<svg class="sport-icon" viewBox="0 0 24 24"><circle cx="6.5" cy="6.5" r="3.2" fill="currentColor"/><path d="M8.7 8.7L18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M17 17.2l3.6 3.6a1.6 1.6 0 0 1-2.3 2.3L14.7 19.5" fill="currentColor"/></svg>`,
    football: `<svg class="sport-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="6" fill="currentColor" transform="rotate(45 12 12)"/><path d="M8.5 15.5l7-7" stroke="var(--panel)" stroke-width="1.3" stroke-linecap="round"/><path d="M9.6 10.4l1 1M11 9l1 1M13.2 12.2l1 1M14.6 10.8l1 1" stroke="var(--panel)" stroke-width="1" stroke-linecap="round"/></svg>`,
    tennis: `<svg class="sport-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M5 5c3 1.2 5.2 3.6 6.2 6.6M19 19c-3-1.2-5.2-3.6-6.2-6.6M5.5 18.5c2.2-2.2 3.4-4.8 3.4-7.3S7.7 6.1 5.5 4M18.5 20c-2.2-2.2-3.4-4.8-3.4-7.3s1.2-5.1 3.4-7.2" fill="none" stroke="var(--panel)" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  };

export const ESPN_TEAMS = {
    NYY:  { sport: "baseball",   leagues: ["mlb"], team: "nyy",   displayName: "Yankees" },
    NYK:  { sport: "basketball", leagues: ["nba"], team: "ny",    displayName: "Knicks" },
    CHE:  { sport: "soccer", leagues: ["all"], team: "363",   displayName: "Chelsea" },
    CHEW: { sport: "soccer", leagues: ["all"], team: "19970", displayName: "Chelsea Women" },
    GFC:  { sport: "soccer", leagues: ["usa.nwsl"], team: "15364", displayName: "Gotham FC" },
    NYG:  { sport: "football", leagues: ["nfl"], team: "nyg", displayName: "Giants" },
  };

export const TENNIS_ATHLETES = {
    ALC: { sport: "tennis", league: "atp", id: "3782", displayName: "Carlos Alcaraz" },
    SIN: { sport: "tennis", league: "atp", id: "3623", displayName: "Jannik Sinner" },
    MED: { sport: "tennis", league: "atp", id: "3749", displayName: "Daniil Medvedev" },
    SAB: { sport: "tennis", league: "wta", id: "3038", displayName: "Aryna Sabalenka" },
    SWI: { sport: "tennis", league: "wta", id: "3730", displayName: "Iga Swiatek" },
    ANI: { sport: "tennis", league: "wta", id: "3221", displayName: "Amanda Anisimova" },
    RYB: { sport: "tennis", league: "wta", id: "3126", displayName: "Elena Rybakina" },
    AND: { sport: "tennis", league: "wta", id: "9820", displayName: "Mirra Andreeva" },
  };

  // Selectable-but-hidden-by-default rivals for the team filter. Each entry
  // doubles as both a TEAMS-shape entry (badge/color/league label — see
  // teamOf()) and an ESPN_TEAMS-shape entry (the `.espn` key — see
  // buildActiveEspnTeams()) for whichever team gets checked on. Grouped by
  // `.league` for the filter panel's section headers.
  //
  // Soccer entries use a real league slug ("eng.1"), not "all" the way
  // CHE/CHEW do — deliberately: a real slug means these also get the
  // verified-accurate live score fix (see pickSummaryLeague/fetchEventSummary
  // above), which "all" can't support. ESPN's numeric team ids for these
  // were confirmed against real espn.com URLs, not guessed — MLB/NBA slugs
  // are ESPN's standard lowercase abbreviations, same convention already
  // trusted for the tracked teams above.
export const EXTRA_TEAM_CATALOG = {
    // MLB — AL East rivals
    BOS: { name: "Red Sox", league: "MLB", color: "#BD3039", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", initials: "BOS",
           espn: { sport: "baseball", leagues: ["mlb"], team: "bos", displayName: "Red Sox" } },
    TOR: { name: "Blue Jays", league: "MLB", color: "#134A8E", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png", initials: "TOR",
           espn: { sport: "baseball", leagues: ["mlb"], team: "tor", displayName: "Blue Jays" } },
    TB:  { name: "Rays", league: "MLB", color: "#092C5C", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png", initials: "TB",
           espn: { sport: "baseball", leagues: ["mlb"], team: "tb", displayName: "Rays" } },
    BAL: { name: "Orioles", league: "MLB", color: "#DF4601", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png", initials: "BAL",
           espn: { sport: "baseball", leagues: ["mlb"], team: "bal", displayName: "Orioles" } },
    NYM: { name: "Mets", league: "MLB", color: "#002D72", sport: "baseball",
           logo: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", initials: "NYM",
           espn: { sport: "baseball", leagues: ["mlb"], team: "nym", displayName: "Mets" } },

    // NBA
    BKN:  { name: "Nets", league: "NBA", color: "#000000", sport: "basketball",
            logo: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png", initials: "BKN",
            espn: { sport: "basketball", leagues: ["nba"], team: "bkn", displayName: "Nets" } },
    CELT: { name: "Celtics", league: "NBA", color: "#007A33", sport: "basketball",
            logo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png", initials: "BOS",
            espn: { sport: "basketball", leagues: ["nba"], team: "bos", displayName: "Celtics" } },
    PHI:  { name: "76ers", league: "NBA", color: "#006BB6", sport: "basketball",
            logo: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png", initials: "PHI",
            espn: { sport: "basketball", leagues: ["nba"], team: "phi", displayName: "76ers" } },
    LAL:  { name: "Lakers", league: "NBA", color: "#552583", sport: "basketball",
            logo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png", initials: "LAL",
            espn: { sport: "basketball", leagues: ["nba"], team: "lal", displayName: "Lakers" } },
    MIA:  { name: "Heat", league: "NBA", color: "#98002E", sport: "basketball",
            logo: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png", initials: "MIA",
            espn: { sport: "basketball", leagues: ["nba"], team: "mia", displayName: "Heat" } },

    // EPL — Chelsea rivals
    ARS: { name: "Arsenal", league: "EPL", color: "#EF0107", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", initials: "ARS",
           espn: { sport: "soccer", leagues: ["eng.1"], team: "359", displayName: "Arsenal" } },
    MCI: { name: "Man City", league: "EPL", color: "#6CABDD", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", initials: "MCI",
           espn: { sport: "soccer", leagues: ["eng.1"], team: "382", displayName: "Man City" } },
    LIV: { name: "Liverpool", league: "EPL", color: "#C8102E", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/364.png", initials: "LIV",
           espn: { sport: "soccer", leagues: ["eng.1"], team: "364", displayName: "Liverpool" } },
    MUN: { name: "Man United", league: "EPL", color: "#DA020E", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", initials: "MUN",
           espn: { sport: "soccer", leagues: ["eng.1"], team: "360", displayName: "Man United" } },
    TOT: { name: "Tottenham", league: "EPL", color: "#132257", sport: "soccer",
           logo: "https://a.espncdn.com/i/teamlogos/soccer/500/367.png", initials: "TOT",
           espn: { sport: "soccer", leagues: ["eng.1"], team: "367", displayName: "Tottenham" } },

    // WSL — Chelsea Women rivals. Reuse each club's men's-side crest (same
    // convention CHEW itself uses for its own badge) since ESPN's women's
    // team ids don't reliably resolve their own distinct crest image.
    // Team ids (19973/20061/19257) and the "eng.w.1" league slug were
    // confirmed against real espn.com women's-team URLs, not guessed —
    // same verification bar as the men's rivals above.
    ARSW: { name: "Arsenal", league: "WSL", color: "#EF0107", sport: "soccer",
            logo: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", initials: "ARS",
            espn: { sport: "soccer", leagues: ["eng.w.1"], team: "19973", displayName: "Arsenal" } },
    MUNW: { name: "Man United", league: "WSL", color: "#DA020E", sport: "soccer",
            logo: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", initials: "MUN",
            espn: { sport: "soccer", leagues: ["eng.w.1"], team: "20061", displayName: "Man United" } },
    MCIW: { name: "Man City", league: "WSL", color: "#6CABDD", sport: "soccer",
            logo: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", initials: "MCI",
            espn: { sport: "soccer", leagues: ["eng.w.1"], team: "19257", displayName: "Man City" } },

    // NFL — Giants rivals (NFC East + the other current Giants storylines).
    DAL: { name: "Cowboys", league: "NFL", color: "#041E42", sport: "football",
           logo: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png", initials: "DAL",
           espn: { sport: "football", leagues: ["nfl"], team: "dal", displayName: "Cowboys" } },
    PHIE: { name: "Eagles", league: "NFL", color: "#004C54", sport: "football",
            logo: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", initials: "PHI",
            espn: { sport: "football", leagues: ["nfl"], team: "phi", displayName: "Eagles" } },
    WSH: { name: "Commanders", league: "NFL", color: "#5A1414", sport: "football",
           logo: "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png", initials: "WSH",
           espn: { sport: "football", leagues: ["nfl"], team: "wsh", displayName: "Commanders" } },
    NYJ: { name: "Jets", league: "NFL", color: "#125740", sport: "football",
           logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png", initials: "NYJ",
           espn: { sport: "football", leagues: ["nfl"], team: "nyj", displayName: "Jets" } },
    SF:  { name: "49ers", league: "NFL", color: "#AA0000", sport: "football",
           logo: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png", initials: "SF",
           espn: { sport: "football", leagues: ["nfl"], team: "sf", displayName: "49ers" } },
  };

  // Named tennis competitors, selectable in the filter panel just like the
  // rival teams above — but unlike EXTRA_TEAM_CATALOG, turning one of these
  // on triggers no new network request: fetchTennisSchedule already pulls
  // the whole ATP/WTA tour (see loadTennisData), so every player's data is
  // already sitting in tennisEventsCache regardless of who's checked. This
  // list just makes specific named players toggle-able even in weeks they
  // aren't currently showing up in the fetched tour window — the same way
  // an MLB/NBA/EPL rival stays selectable whether or not they're playing
  // this week. Keyed "league:id" to match extraTennisPlayers/row.dataset.code.
  // Novak Djokovic lives here (moved from TENNIS_ATHLETES) — he's now a
  // selectable competitor rather than an always-tracked player.
export const EXTRA_TENNIS_CATALOG = {
    'atp:296':   { league: 'atp', id: '296',   name: 'Novak Djokovic' },
    'atp:2375':  { league: 'atp', id: '2375',  name: 'Alexander Zverev' },
    'atp:3209':  { league: 'atp', id: '3209',  name: 'Félix Auger-Aliassime' },
    'atp:11316': { league: 'atp', id: '11316', name: 'Ben Shelton' },
    'atp:2946':  { league: 'atp', id: '2946',  name: 'Taylor Fritz' },
    'atp:2638':  { league: 'atp', id: '2638',  name: 'Sumit Nagal' },
    'wta:2113':  { league: 'wta', id: '2113',  name: 'Jessica Pegula' },
    'wta:3626':  { league: 'wta', id: '3626',  name: 'Coco Gauff' },
    'wta:1859':  { league: 'wta', id: '1859',  name: 'Elina Svitolina' },
    'wta:394':   { league: 'wta', id: '394',   name: 'Serena Williams' },
    'wta:403':   { league: 'wta', id: '403',   name: 'Venus Williams' },
    'wta:3398':  { league: 'wta', id: '3398',  name: 'Emma Raducanu' },
    'wta:3641':  { league: 'wta', id: '3641',  name: 'Leylah Fernandez' },
  };
