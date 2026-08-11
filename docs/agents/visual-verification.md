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
width is part of the state. Cases live in `ArgoUI/Specimen/SpecimenCatalog.swift`.

**Drive it like a user** — `sh scripts/e2e-test.sh`, also from `apps/macOS`. The only tests here
that click; every other Swift test builds a projection and asserts on it.

## Why the screenshot script quits a running Argo

`bun run screenshot --filter=@argo/macos -- <out.png>` builds the app, launches it, and
captures the WINDOW rather than the screen. It quits any running Argo first, and that step
is load-bearing: `open` on an already-running bundle id activates THAT instance, so a copy
left up by another worktree yields a plausible-looking screenshot of somebody else's tree.

Screen Recording permission is required the first time a terminal captures another
process's window. Without it the PNG is blank rather than an error.

## Specimens — one state in isolation

`ArgoUI/Specimen/SpecimenCatalog.swift` holds a `Specimen` case per renderable state.
Adding a case is all it takes to add a state: `scripts/specimens.sh` reads the names out of
the catalog rather than repeating them. Both scripts live under `apps/macOS/scripts/` and are
run from `apps/macOS`.

A width is part of the state for anything laid out in columns, which is why
`ARGO_WINDOW_SIZE=<w>x<h>` exists — the narrow case is then a render somebody else can
repeat, not a window someone dragged by hand.

The app launched against an ordinary checkout shows no Sessions, so without a specimen the
surface being built is never actually looked at.

## What the pixels are judged against

The design decisions carry no measurements, so `docs/designs/cockpit-sessions-liquid-glass.png`
is the only source for rhythm, density and type size. Prose in the decision log can be
satisfied while the approved pixels are not.

The rhythm itself lives in `ArgoUI/VisualContract/`, rendered by the `foundations` specimen.
That, not an HTML page, is the living token contract (`rules/design-system.md`).

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
