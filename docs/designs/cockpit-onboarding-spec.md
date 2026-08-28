# Onboarding spec

> Wayfinder #165, part of #157. **Getting from a blank app to a usable project.** Onboarding
> *is* creating a Project (ADR-0015) — the panel is the project-setup surface, not a gated wizard.
> Reconstructed from #165's resolution by #205: the original prototype and spec were built and
> grilled HITL but **never committed**. There is **no `cockpit-onboarding-prototype.html`** —
> this doc is the artifact of record, and onboarding is the one surface #178's switcher has no
> file to stitch. Look/density are Phase 2.

## Shape — two screens, three independent rows

1. **Welcome** — plain language: what Argo does, in three benefit rows. No jargon, no tier
   ladder, no feature grid.
2. **Connect** — three **independent** connection rows, completable **in any order**, none
   blocking another:
   - **Folder** — the project's scope.
   - **Connections** — Ticket provider + code host.
   - **Companion plugin** — the CONVENTION-tier upgrade.

This is a panel, not a funnel: it is re-entered later from Settings (entry points owned by the
shell spec, #172), and the same panel serves reconnect (§Error).

## Folder, not repository, is the floor

- A **folder** — new or existing — is all that is required. **Git is not required.**
- An empty greenfield folder creates a project **at the observation floor**: sessions and files
  work; there is simply nothing derived to show yet.
- Git + a provider **unlocks** backlog, PRs, and CI. It never **gates** entry. The failure mode
  this avoids: a wizard that refuses to start until you have a repo and an org.
- **CTA = `Create project`**, enabled the moment a folder is set. Connections can follow.

## Connections — one sign-in, both ports

- **One GitHub OAuth device-flow sign-in feeds both ports** (Tickets *and* code host,
  ADR-0014). It is not two connections wearing one name — it is one grant, and it fails as one
  (`cockpit-failure-states-spec.md` §2, account level).
- Tokens are **keychain-stored per machine** (ADR-0018). No `gh` CLI dependency.
- The device-flow **`connecting`** state shows the user code and the verification URL; the panel
  waits, it does not spin blind.
- **"Use Linear for issues"** is offered as a **secondary path** — GitHub-first in v1; the
  Linear-specific onboarding pixels are deferred.

## Honesty tiers are internal only

`DIRECT` / `DERIVED` / `CONVENTION` (ADR-0016) never appear on screen. An earlier draft showed a
Direct/Derived/Convention ladder and it was **cut**: each connection's payoff is stated as plain
benefit copy ("see your backlog and open PRs"), not as a tier the user has to learn. The tiers
stay an internal provenance attribute — same rule the status registry states for facts.

## States

| State | What it is |
|---|---|
| `welcome` | first screen — what Argo does |
| `fresh` | Connect panel, nothing set |
| `direct` | folder set, no connections — the observation floor, honestly usable |
| `connecting` | device code shown, awaiting the browser |
| `partial` | half-onboarded: some rows done, the rest still offered, project already usable |
| `wired` | folder + provider + plugin — the fully-wired target (ADR-0016) |
| `error` | expired / revoked / unreachable — see below |

## Error and re-entry — in-panel, never a separate settings surface

- An expired or revoked grant re-enters **this panel**, offering **`Continue offline`** and
  **`Reconnect`**. There is no separate connections-settings screen to hunt for.
- This is where `cockpit-failure-states-spec.md`'s **`needs reconnect`** chip lands (§3): the chip
  is the pointer, this panel is the destination.
- **`folder not found`** is not an onboarding state — the project is disabled with one error
  (Relocate / Remove), failure spec §6.

## Content

Copy passed through the `ux-writing` skill: user-side language, the **[what · why · fix]** error
pattern, tightened lines, **no em dashes**. Status words come from
`cockpit-status-vocabulary.md`; onboarding invents none.

## Deferred / not owned here

- **Linear-specific onboarding pixels** — GitHub-first v1.
- **State-map editor** (#167) — the provider-state→canonical map ships heuristic-seeded.
- **Settings entry points that reuse this panel** — owned by the app shell spec (#172).
- **The empty first-run shell** — the seam *before* this panel is the shell's (#172); it hands off
  here.
- **A committed prototype** — cut by #205. The pixels were agreed live in the #165 grill, Phase 2
  redoes the visual contract, and no human would grill a reconstruction. If a renderable
  onboarding surface is wanted for #178's switcher, it is a fresh ticket, not a recovery.
