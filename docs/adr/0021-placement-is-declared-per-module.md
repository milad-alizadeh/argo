# 0021 · Placement is declared per module, and an undeclared module fails

Status: accepted · 2026-08-06

Supersedes `composition-root-check.mjs` (one hardcoded path) with `root-files-check.mjs`.

## Context

`rules/file-structure.md` has said since it was written that a folder root accumulating 5+ peer
files must be split, and that this "applies to every module in the codebase." The rule is scoped
to `apps/desktop/**`, loaded on every `.ts` touch, and stated in plain English.

It was read. It did nothing:

| module root | non-test peer files | gated? |
|---|---|---|
| `src/main/` | 11 | no |
| `rooms/sessions/` | 12 (7 sharing an `interior` prefix — a folder wearing a prefix as a disguise) | no |
| `cockpit/` | 9 | no |
| `shell/` | 5 | no |
| `src/shared/` | 23 (8 sharing a `feed` prefix) | no |
| `src/renderer/src/` | 0 loose beyond 5 declared KIND files | **yes** |

The one path a gate covered is the only one that held. That is not a coincidence to be argued
with; it is the whole finding. `composition-root-check.mjs` compiled from a single
`placement.compositionRoot` entry with one hardcoded `path`, so it was structurally a one-module
gate — and **a module absent from its config was silently exempt**. Every module added after it
inherited that exemption by default and flattened.

The specific mechanism in `main/` is worth recording, because it is the failure a *better* rule
would still have produced. Five of its eleven root files were IPC bridges sitting outside the
domain each wired (`gitBridge.ts` beside `git/`, `projectionBridge.ts` beside `hub.ts`). Naming
was not the problem — `git/` and `observe/` were already correct. What had no declared home was
the *wiring layer*, so it defaulted to the root. That is the renderer's `cockpit/` shape applied
one process over, minus the reason that justifies it: renderer slices are pure Views, so a store
read cannot live inside one; main has no such constraint. **An exemption written for one reason
reads as a pattern to the next author who sees only its shape.**

## Decision

**Every module in the map declares what may sit loose at its root, and a module with no entry is
a build failure.**

- Config is `placement.rootFiles.modules.<name>`, keyed by basename, with `allow` (KIND — the
  rule does not apply to that category) and `ratchet` (RATCHET — debt; the list may only shrink),
  the same convention as `biome.jsonc` and `scripts/jscpd-ignore-reasons.txt`.
- The root pattern is derived from the module's own `path`; `path` overrides it where the two
  differ (only the renderer's, whose module path is `src/renderer/` and whose root is
  `src/renderer/src/`).
- A stale entry — one naming no file — fails too, so the ratchet cannot sit there
  re-authorising a future breach after the file it named is gone.
- A file belonging to **no** declared module also fails, closing the same hole one level up.

Consequent to it, `main/` was carved into `hub/ · projects/ · terminals/ · git/ · observe/`, each
domain owning its own bridge, and the placement gates moved to pre-commit.

## Consequences

- **Adding a module costs one required key.** This is the point, not friction to be optimised
  away. The instinct on hitting a red build for a rule you never wrote is to make the default
  permissive — that is precisely the change this ADR exists to refuse. If a module genuinely has
  nothing to declare, `{"allow": {}, "ratchet": {}}` says so explicitly and takes two seconds.
- **65 existing breaches are recorded as RATCHET entries**, each naming the folder its file
  should move to. The ratchet reads as embarrassing on day one; it is the first time the
  flattening has been counted rather than described, and it doubles as the migration plan.
- **Prose that a gate now enforces was cut** rather than kept alongside it, and the reasoning
  moved into the gate's failure message — read at the moment it applies rather than on every
  file touch. More rules do not produce more compliance; each added paragraph lowers the odds
  any given paragraph changes behaviour, and none of them fail a build.
- The gates run on **pre-commit**, reversing an earlier call that grouped them with duplication
  as CI-shaped. Their cost is not comparable (a glob and a basename compare, versus jscpd
  tokenizing every file), and the timing is the point: a misplaced file caught in CI becomes a
  follow-up ticket written after the session that produced it has ended.
- **Not addressed:** the three placement gates ship in this repo's `scripts/` only — no skill
  distributes them, and `setup-module-boundaries`' template map has no `placement` block at all.
  A consumer installing the module map gets the boundary linter without any of this.
