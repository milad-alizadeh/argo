# Visual verification — currently none

This file described `/pixel-review`'s route into the Swift cockpit: `screenshot.sh`, `specimens.sh`,
`e2e-test.sh`, `record-figures.sh` and the `HoldClick`, `OutlineCount` and `WindowID` helpers beside
them. All of it is deleted (#1758), because `apps/macOS` is deprecated in favour of the Electron app
and its tooling went with it.

**So there is nothing to render.** `/pixel-review` has no app to drive. A UI ticket cannot be proved
by pixels until `apps/desktop` provides a rendering route, and choosing that route is open work on
the migration map.

## What outlives the tooling

Four things were learned the expensive way and apply to whatever replaces it.

- **A screenshot needs Screen Recording permission**, or the PNG is silently blank. Not an error, a
  black image.
- **An e2e run holds the real keyboard and mouse for its whole length.** Say so and wait before
  starting one.
- **A locked screen kills input, not capture.** Screenshots keep working and keystrokes go nowhere,
  so a suite fails in a way that looks like a bug in the app.
- **Never hand-roll a load generator.** Use `sh scripts/load-burst.sh <workers> <seconds>`, which
  burns CPU cores and makes no Sessions, and stop it with the `--reap <token>` it prints, never a
  bare `pkill`. That script survives; it is not Swift-specific.

## The trap worth restating for the Electron route

**A render is not a click.** A synthetic or scripted press does not always produce the platform's
own pressed state, so a screenshot taken during a scripted hold can show a control that a human
finger would have drawn differently. Whatever drives `apps/desktop`, check a real interaction before
trusting a scripted one.
