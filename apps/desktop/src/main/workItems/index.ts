// The Work Item provider port (ADR-0014 / ADR-0018): tickets reach the cockpit over OAuth and
// the provider's HTTP API, polled, with per-machine tokens in the OS keychain. GitHub Issues is
// v1's adapter; the port is what a second one plugs into.

export { wireWorkItems } from './bridge'
export { nodeHttp } from './http'
export { createWorkItemSync, type WorkItemSync } from './sync'
export { createTokenStore } from './tokenStore'
