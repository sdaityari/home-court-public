/**
 * Current sport scope for /sport/<sport> views.
 *
 * app.py renders <body data-sport="..."> — empty string on the default
 * "/" (everything tracked), one of the SPORTS slugs on a sport-specific
 * view. This is the one place that reads it, so every other module
 * (filters.js, main.js) just calls sportMatches() rather than touching
 * the DOM attribute itself.
 */

export const CURRENT_SPORT = document.body.dataset.sport || '';

// True when a given team/athlete's `sport` tag belongs on the current
// page — always true on the unscoped "/" view.
export function sportMatches(sport) {
  return !CURRENT_SPORT || sport === CURRENT_SPORT;
}
