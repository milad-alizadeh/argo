# 0018 · Provider access is OAuth + HTTP API, not the `gh` CLI

Status: accepted (#182) · 2026-07-22

## Context

ADR-0014 established two adapter ports (Work Item provider, Code host) but left the *access
mechanism* implicit, and early notes assumed the `gh` CLI for GitHub. The #182 rebuild made
multi-provider (GitHub Issues **and** Linear) a v1 goal, which forces the question: how does
the cockpit app authenticate to and read from providers?

`gh` only exists for GitHub — there is no equivalent binary to shell to for Linear. Leaning on
`gh` would make GitHub a special case and leave every other provider on a different mechanism,
defeating the point of a uniform port interface. It also imposes a hidden dependency (the user
must have `gh` installed and authed) that the app can't own.

## Decision

- **The cockpit connects to providers via OAuth + the provider's HTTP API** (REST/GraphQL) —
  one uniform mechanism behind the port interface, per-provider adapters underneath.
- **Onboarding owns provider connection** — "Connect GitHub" / "Connect Linear" run the OAuth
  grant. **The exact grant is per-provider, not one shared flow** (verify before building): a
  distributed desktop binary can't hold a `client_secret`, so GitHub likely needs the **Device
  Flow** (or a GitHub App user-to-server token), *not* loopback-PKCE — and token **lifecycle
  differs** (GitHub OAuth-App user tokens historically don't expire / have no refresh token
  unless expiring-tokens is enabled; Linear issues expiring tokens *with* refresh). So token
  refresh is a **per-adapter** concern, not a shared assumption. Tokens are stored
  **per-machine in the OS keychain** (never the repo, never plain files) — same per-machine
  ownership as the Project registry (ADR-0017); **Linux needs a `libsecret`/`safeStorage`
  fallback story** where a keychain is absent.
- **One GitHub OAuth grant feeds both ports** (Issues → Work Item provider, PRs/CI → Code
  host); Linear is Work-Item-only.
- **Status is polled**, not pushed — a desktop app has no public endpoint to receive webhooks.
  Adapters use conditional requests (ETags / `If-None-Match`) and backoff to stay within rate
  limits.
- **This is the *cockpit app* layer only.** Agents operating the repo (Claude Code / Codex)
  still use `gh` per AGENTS.md / `issue-tracker.md`. The two layers are independent — the app
  going OAuth+API does not change how agents drive the repo.

## Why

- A uniform OAuth+API mechanism is the only thing that scales across GitHub, Linear, and future
  providers without special-casing one; the port interface stays honest.
- Self-contained onboarding removes the hidden `gh`-installed-and-authed dependency the app
  could neither guarantee nor own.
- Keychain, per-machine tokens match ADR-0017's ownership model exactly.

## Consequences

- New surface to build: OAuth app registration per provider, the desktop PKCE flow, secure
  token storage + refresh, and a polling scheduler with rate-limit handling.
- ADR-0014 is amended: its ports are OAuth-API adapters; "native reads" there means reading the
  provider's native references over its API (DIRECT-tier), not shelling to `gh`.
- Offline / token-expired is a first-class honest state — a provider that can't be reached
  degrades to "not connected," never a fabricated read.
