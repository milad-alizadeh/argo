# 0018 · Provider access is OAuth + HTTP API, not the `gh` CLI

Status: accepted (#182) · 2026-07-22 · GitHub's grant settled (#367) · 2026-08-06 ·
**amended: a provider has N accounts** (#414) · 2026-08-10

> **A provider has N Accounts on a machine, not one.** This ADR says "tokens are stored
> per-machine in the OS keychain" and reads throughout as though a provider had *one* grant.
> A user with a personal GitHub and a work GitHub has two, and the repos they can see do not
> overlap. So: the keychain is **keyed by Account** (provider + the provider's own stable id for
> the identity, not the login, which renames); a Project's use of a provider is a **Binding**
> naming one Account and one port plus its provider-side scope; and **authorizing is
> Account-level while choosing is Binding-level**, so a second Project on an already-authorized
> provider binds with no OAuth round-trip.
>
> Two consequences correct statements made elsewhere. "One GitHub grant feeds both ports and
> fails as one" holds **within an Account** only — a second GitHub Account is a separate grant
> with its own independent failure. And #260's account-level blast radius, "every GitHub-bound
> project at once," becomes **every Binding naming that Account** — which is a strictly smaller
> and more honest set.
>
> A Binding is **validated against its Account when it is made**. A wrong Account is otherwise
> silent: reads 404, and a 404 is indistinguishable from a ticket that does not exist. Bind time
> is the only moment the two are separable.
>
> The alternative — one grant per provider, re-authorized to switch identity — is what #265
> shipped (`CockpitState.grant`, a single account-level fact) and is simpler by exactly one
> level of indirection. It was rejected because switching identity would silently re-point every
> Project already bound to the old one, which is the failure this ADR's own "never a fabricated
> read" principle exists to prevent.

> **GitHub's grant is an OAuth App + device flow, scope `repo`** — the first of the two options
> the Decision below left to verify, settled in #367 and shipped by #256. It is the grant that
> feeds both ports from one consent, and its non-expiring user token is why no refresh path
> exists for GitHub. A GitHub App would narrow the scope per repository at the cost of that
> refresh path and a not-installed-here state; the trigger to revisit is **distributing to users
> inside orgs**, which is where `repo` asks too much and org OAuth-App policy bites.
> The client id is public by construction and ships in the binary.

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
  grant. **The exact grant is per-provider, not one shared flow** (verify before building; for
  GitHub, see the amendment above): a distributed desktop binary can't hold a `client_secret`,
  so GitHub needs the **Device Flow** (or a GitHub App user-to-server token), *not*
  loopback-PKCE — and token **lifecycle
  differs** (GitHub OAuth-App user tokens historically don't expire / have no refresh token
  unless expiring-tokens is enabled; Linear issues expiring tokens *with* refresh). So token
  refresh is a **per-adapter** concern, not a shared assumption. Tokens are stored
  **per-machine in the OS keychain, keyed by Account** (never the repo, never plain files) —
  same per-machine ownership as the Project registry (ADR-0017); **Linux needs a
  `libsecret`/`safeStorage` fallback story** where a keychain is absent.
- **One GitHub OAuth grant feeds both ports** (Issues → Work Item provider, PRs/CI → Code
  host); Linear is Work-Item-only. Per the amendment above, this holds **per Account**.
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
