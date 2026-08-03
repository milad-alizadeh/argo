# 0019 · The Concierge orb is CSS, not a WebGL scene

Status: accepted · 2026-08-03

## Context

The v1 eclipse orb was migrated into the cockpit as a three.js engine (#153):
`domains/concierge/eclipseOrb/` (a ~600-line scene builder plus ~400 lines of
shaders), a 15KB `sceneConfig.ts` tuning table, a 1.5MB background photo, and two
React surfaces mounting it — the full-screen `EclipseScene` backdrop and the
roster's `ConciergeDock` mini orb.

The #157 reset left that engine without an owner, and the contradiction was live:

- `docs/designs/cockpit-ui-inventory.md` said "salvage into `shell` — the orb
  engine is the shell's orb (`OrbMini`)".
- #264 built `OrbMini` as a **cheap CSS ring** instead, because the merged top bar
  wants a 38px glyph and the engine has no 38px rendering. The same ticket stopped
  passing `ConciergeDock` into the roster, so the dock orb was already dead code.
- `cockpit-spec.md` ships only the orb **seat** in the top bar; behaviour belongs
  to map #190.
- The settled look, `docs/designs/cockpit-penumbra-reference.html`, renders the
  orb as a CSS corona plus sphere. There is no canvas in the reference.

So the engine belonged to a domain marked retired, while the only thing still
rendering it was `SessionScreen`'s backdrop — a screen #267 rewrites.

## Decision

**Delete the three.js engine. The orb is a CSS rendering.**

- `domains/concierge/` is removed whole: `eclipseOrb/`, `sceneConfig.ts`,
  `EclipseScene`, `ConciergeDock`, `useEclipseOrb`, their stories, and
  `assets/cockpit_bg.webp`. The `three` and `@types/three` dependencies go with
  them.
- `OrbMini` (`shell/components/top-bar/`) is the orb, and it is the shell's.
- The lit scene each room paints behind the floating chrome is a **token-contract
  background** — the plane family and the dust scrim #262 settled — not a
  procedural WebGL scene. The Sessions room paints its own in #267; until then the
  stage is the flat `--background`.

"Attention = brightness, the orb is the brightest object" (#158) is a **contract
about tone**, and CSS satisfies it. The spec already decoupled it from any
gradient originating at the orb.

## Why

- **Nothing settled asks for a scene.** Penumbra's orb is CSS, the spec ships a
  seat, and `OrbMini` already fills that seat. Homing the engine anywhere —
  `shell`, `renderer-shared`, or a room — parks 1,000 lines and 1.5MB that render
  in zero surfaces, and `renderer-shared`'s own rule wants two callers.
- **A full-screen WebGL scene is the exact cost the low-spec target cannot pay.**
  The retired `SessionScreen` had to freeze the stage whenever a session covered
  it and hand animation to a second orb, so that only one orb ever ran. That
  contract existed because the scene was expensive; deleting the scene deletes the
  contract rather than carrying it into three rooms.
- **Deletion is recoverable, drift is not.** The engine is in git history and in
  #153's PR. An unowned module that four documents describe differently is the
  thing that costs, and it had already produced one contradiction (`OrbMini` vs
  the inventory row) in a single ticket.

## Consequences

- If map #190 wants a procedural orb, it re-derives one against the settled token
  contract and the top-bar seat's geometry, and restores from history only what
  survives that decision. It does not inherit a full-screen scene by default.
- The Sessions room owes a backdrop (#267). Between this change and that one the
  cockpit's stage is flat, which is honest: no surface claims a scene it lacks.
- `domains/concierge/` leaves `apps/desktop/scripts/module-boundaries.json`. The
  four remaining retired domains keep their rules until their last file moves
  (#284 blocked on #267–#274).
