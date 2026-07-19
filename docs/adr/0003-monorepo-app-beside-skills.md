# The app lives in this monorepo, beside the skills package

**Context.** `~/Developer/argo` is already a bun + turbo monorepo, currently holding only `packages/argo-skills`. The new Electron cockpit needs a home. The alternative was a separate repo to keep the distributed `argo-skills` package isolated from a heavy app.

**Decision.** Add the app as **`apps/desktop`** in this monorepo. Anticipated siblings: `apps/voice` (the audio-to-audio sidecar) and `packages/plugin` (the required companion plugin). App, plugin, and skills version and ship together.

**Why.** They are one product, not three: the companion plugin is *required* in every managed session, so the app and the plugin/skills must move in lockstep — which a monorepo gives for free. The repo is already bun + turbo with the mattpocock flow, `AGENTS.md`, `CONTEXT.md`, and `docs/adr/` set up here; nothing needs converting.

**Consequences.** `argo-skills` no longer has an independent repo/release cadence — accepted, since it's part of this product. The `apps/*` + `packages/*` shape mirrors argo-v2's layout, but as a **conventional monorepo structure only — not a code import** (see ADR-0001); no v2 source is lifted.
