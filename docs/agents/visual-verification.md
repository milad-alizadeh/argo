# Visual verification — currently none

This file described `/pixel-review`'s route into the Swift cockpit: `screenshot.sh`, `specimens.sh`,
`e2e-test.sh`, `record-figures.sh` and the `HoldClick`, `OutlineCount` and `WindowID` helpers beside
them. All of it is deleted (#1758), because `apps/macOS` is deprecated in favour of the Electron app
and its tooling went with it.

**The Electron route now exists**, and `docs/design-stack.md` is where it is written down:
Storybook for a component, `bun run capture:cockpit` for the packaged screen, and a design page
for a screen that has a design ticket. What that route deliberately does not have is a committed
picture. Every capture is disposable, no gate reads one, and no ref holds one (#1910).

## What outlives the tooling

Four things were learned the expensive way and apply to whatever replaces it.

- **A screenshot needs Screen Recording permission**, or the PNG is silently blank. Not an error, a
  black image.
- **An e2e run holds the real keyboard and mouse for its whole length.** Say so and wait before
  starting one.
- **A locked screen kills input, not capture.** Screenshots keep working and keystrokes go nowhere,
  so a suite fails in a way that looks like a bug in the app.
- **Never hand-roll a load generator.** `load-burst.sh` is deleted, and whatever replaces it
  keeps its two properties: it burns CPU cores while making no Sessions, so load never reaches the
  thing under test as work, and it is stopped by a token it prints rather than a bare `pkill`.

## The trap worth restating for the Electron route

**A render is not a click.** A synthetic or scripted press does not always produce the platform's
own pressed state, so a screenshot taken during a scripted hold can show a control that a human
finger would have drawn differently. Whatever drives `apps/desktop`, check a real interaction before
trusting a scripted one.
