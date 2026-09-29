// The loopback origins the packaged Ticket proof serves its mock providers from. Read only while the
// Project proof store is set, so an ordinary launch never takes them (src/main.ts).
export const GITHUB_PROOF_ORIGIN_ENV = 'ARGO_GITHUB_PROOF_ORIGIN'
export const LINEAR_PROOF_ORIGIN_ENV = 'ARGO_LINEAR_PROOF_ORIGIN'
// The Ticket proof's poll in milliseconds, in place of the minute a person waits.
export const TICKET_POLL_PROOF_ENV = 'ARGO_TICKET_POLL_PROOF_MS'
