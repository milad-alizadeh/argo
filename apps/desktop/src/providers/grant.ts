// What a provider granted an Account, as the grant store keeps it (#1763). The scopes are the ones
// granted, never the ones asked for. `renewal` is how a short-lived token is replaced before it
// lapses; GitHub's tokens do not lapse and carry none.
export type Grant = {
  accessToken: string
  scopes: string[]
  renewal: { refreshToken: string; expiresAt: number } | null
}

// How a sign-in ended. Only `granted` stores anything.
export type GrantOutcome =
  | { kind: 'granted'; grant: Grant }
  | { kind: 'declined' | 'expired' | 'cancelled' | 'unreachable' | 'refused' }

// Who signed in: the provider's stable id keys the Account, and the rest is display.
export type Identity = {
  providerAccountId: string
  login: string
  // The Linear workspace the grant belongs to; GitHub has none.
  workspace: string | null
}

export const grantedScopes = (scope: unknown): string[] => {
  if (Array.isArray(scope)) return scope.filter((entry) => typeof entry === 'string')
  return typeof scope === 'string' ? scope.split(/[\s,]+/).filter(Boolean) : []
}

// A token endpoint's answer to a code exchange or a renewal. `refused` is an OAuth error: the code or
// the refresh token is spent, and only a new sign-in gets a grant.
export type TokenReply =
  | { ok: true; grant: Grant }
  | { ok: false; failure: 'refused' | 'rate-limited' | 'unreachable' }
