// The loopback origin the packaged Ticket proof serves its fake GitHub from. Read only while the
// Project proof store is set, so an ordinary launch never takes it (src/main.ts).
export const GITHUB_PROOF_ORIGIN_ENV = 'ARGO_GITHUB_PROOF_ORIGIN'
