// The loopback origins the packaged Ticket proof serves its fake providers from. Read only while the
// Project proof store is set, so an ordinary launch never takes them (src/main.ts).
export const GITHUB_PROOF_ORIGIN_ENV = 'ARGO_GITHUB_PROOF_ORIGIN'
export const LINEAR_PROOF_ORIGIN_ENV = 'ARGO_LINEAR_PROOF_ORIGIN'
