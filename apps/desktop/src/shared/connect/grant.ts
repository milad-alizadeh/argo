// The GitHub grant behind the connect panel (ADR-0014 / ADR-0018): ONE OAuth device-flow
// sign-in feeds both ports, so there is one token in the keychain and one thing to fail. That
// is why this is a single account-level fact on the projected state rather than one per
// Project — a revoked grant re-enters the connect panel for every project at once.

export const GRANT_STATES = ['none', 'connected', 'needs-reconnect'] as const

/**
 * `none` — never signed in, or the token this machine holds cannot be read.
 * `connected` — a token is held and the provider has not refused it.
 * `needs-reconnect` — the provider refused the token: expired, revoked, or scope-stripped.
 *
 * There is deliberately no `stale` here: a poll that merely failed leaves the grant
 * `connected` and the fetched data rendered at full fidelity (failure policy §1).
 */
export type GrantState = (typeof GRANT_STATES)[number]
