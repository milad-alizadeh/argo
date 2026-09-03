# Visual verification — the detail

AGENTS.md carries the directive and the two warnings that must bind without opening a file.
This is everything a session needs only once it is actually rendering something.

## The commands

**Render whole app states** — `bun run screenshot --filter=@argo/macos -- <out.png>`, from the
repo root. Against an ordinary checkout this shows no Sessions, so it is the wrong tool for
looking at a surface you are building.

**Render one state in isolation** — the right one. From `apps/macOS`:
`ARGO_SPECIMEN=<case> sh scripts/screenshot.sh out.png`, or `--specimen <case>`;
`sh scripts/specimens.sh <dir> [name …]` for the set, and `ARGO_WINDOW_SIZE=<w>x<h>` when a
width is part of the state. Entries live in `ArgoSpecimens/SpecimenRegistry+*.swift`, and
`Argo --list-specimens` prints every name.

**Hold a click on one point** — `swift scripts/HoldClick.swift <pid> <x> <y> <out-prefix>`, against
an app left up with `ARGO_KEEP_RUNNING=1`. It captures the window mid-press and after release, the
one state a still specimen has no name for (#1137). It moves the real pointer and presses the real
button, so it is under the same rule as an e2e run: say so and wait. Its header records what a
scripted press does and does not draw.

**Drive it like a user** — `sh scripts/e2e-test.sh`, also from `apps/macOS`. The only tests here
that click; every other Swift test builds a projection and asserts on it.

## Why the screenshot script launches the binary, not the bundle

`bun run screenshot --filter=@argo/macos -- <out.png>` builds the app, launches it, and
captures the WINDOW rather than the screen. It runs `Argo.app/Contents/MacOS/Argo` directly
and keeps the pid, and that is load-bearing: `open` on an already-running bundle id activates
THAT instance instead of launching this build, so a copy left up by another worktree would
yield a plausible-looking screenshot of somebody else's tree — the one failure a screenshot
cannot self-report.

A direct launch starts this build regardless, so nothing has to be closed to make the capture
honest. Every step downstream is scoped to that pid — `WindowID.swift` matches
`kCGWindowOwnerPID`, `ARGO_WINDOW_SIZE` resizes the process with that `unix id`, and the
trailing quit signals it alone. Two Argos can therefore be up at once, and a render leaves the
dev build you are looking at running (#885). `scripts/screenshot-scope.test.mjs`, in
`bun run test:hooks`, is what holds that.

Screen Recording permission is required the first time a terminal captures another
process's window. Without it the PNG is blank rather than an error.

## Specimens — one state in isolation

`ArgoSpecimens/SpecimenRegistry+*.swift` holds a `SpecimenEntry` per renderable state, in the
file for its subject. Adding an entry is all it takes to add a state: `scripts/specimens.sh` asks
the app for the names with `--list-specimens` rather than repeating them or parsing Swift source.
Both scripts live under `apps/macOS/scripts/` and are run from `apps/macOS`.

A width is part of the state for anything laid out in columns, which is why
`ARGO_WINDOW_SIZE=<w>x<h>` exists — the narrow case is then a render somebody else can
repeat, not a window someone dragged by hand.

The app launched against an ordinary checkout shows no Sessions, so without a specimen the
surface being built is never actually looked at.

## What the pixels are judged against

The design decisions carry no measurements, so `docs/designs/cockpit-sessions-liquid-glass.png`
is the only source for rhythm, density and type size. Prose in the decision log can be
satisfied while the approved pixels are not.

The rhythm itself lives in `ArgoDesign`, rendered by the `foundations` specimen.
That, not an HTML page, is the living token contract (`rules/swift.md`). The directory
holds tokens only: the shared views drawn with them are `ArgoAtoms`, and one surface's own
measures — the feed's column, the composer's vessel, the minimap's lane, the plan pill, the
toolbar's vessel, the context bar, the Connect panel, the agents rail, the roster's foot — sit in
that surface's directory under `Shell/`, not in the contract. `ArgoLayout` is the one measure
sheet still in `ArgoDesign`, and it holds the splits between panes, which describe the
window rather than any one surface.

## A render is not a click

`apps/macOS` has one XCUITest target, `ArgoE2ETests` — the only tests here that launch Argo
and drive it. Every other Swift test is a SwiftPM package test that can build a projection
and assert on it but cannot click, so a view that renders correctly in a specimen and comes
apart inside a popover passes all of them.

It is a **local** gate, deliberately not a CI one: driving the real app needs a macOS
runner, the most expensive minutes GitHub bills, on every push. Run it when you touch a
surface only reachable by clicking.

Two things about it that are not obvious: the first run on a machine answers a macOS
authorisation prompt by hand, and a sleeping display fails the same way; and a test must
launch onto a `--specimen`, never the machine's own registry, or it asserts whatever that
Mac happens to have on it.

### What the machine has to be, for that suite to mean anything

Four conditions decide whether a red case is a regression or the weather. A red baseline cannot
tell a bug from a toggle, so check these before believing a failure (#764).

- **Full Keyboard Access must be on** — System Settings › Keyboard › Keyboard navigation
  (`AppleKeyboardUIMode`), not the Accessibility item that still carries the older name. With it off no plain `Button` is a Tab stop, so every case that walks the deck by
  Tab — `DeckKeyboardE2ETests`, `PlanPillE2ETests` — fails on a machine where the product is
  perfect. DeckKeyboard's failure text says so and prints the ring it walked; PlanPill's
  only says the keyboard never reached the pill.
- **A hover is not a gesture this suite has.** `XCUIElement.hover()` warps the cursor
  without producing the tracking-area crossing SwiftUI's `.onHover` answers to, so a case
  asserting a hover-only path fails against a control that opens perfectly by hand. Assert
  the click or the key instead, and cover the hover state with a render.
- **`RosterOrderE2ETests` puts Finder in front and comes back**, several times. It needs a
  display that can take a front-app switch, which is the same condition as the sleeping one
  above.
- **Accessibility permission** for whichever terminal runs the render: `ARGO_WINDOW_SIZE`
  resizes through System Events, and the AX walk below reads through the same gate.

### Reading the labels a test matches, without running the suite

SwiftUI builds **no accessibility tree at all** in a process with no client attached, which
is why every package test passed while the feed was silent (#777). Attaching a client is all
it takes, and any process can: launch one state with `ARGO_KEEP_RUNNING=1 ARGO_SPECIMEN=<case>
sh scripts/screenshot.sh out.png`, then walk `AXUIElementCreateApplication(pid)` over that pid
and print each element's role and `AXDescription`. `AXUIElementPerformAction(…, kAXPressAction)`
presses a control from there, and a `CGEvent` posted with `postToPid` delivers a key
equivalent to that process alone.

None of it moves the pointer or takes the keyboard, so it is the way to settle "does this
publish the label the test addresses, and does pressing it open what the test waits for"
while somebody else is using the machine. It is not a substitute for the run, and #764 paid to
learn where the line is: it cannot say whether Tab arrives, it drives AppKit's press rather than
a click, and a key delivered by `postToPid` skips every layer between the keyboard and the
process — so it proves a shortcut FIRES, never that the key reaches the app in the first place.
