# Designs

The committed design set for the Argo cockpit: written specs, the approved visual target, and
the renders the app itself produces.

> **Runtime locked 2026-08-07 (ADR-0022):** the cockpit is pure Swift 6 and SwiftUI on macOS 26.
> The Electron implementation and every HTML study that documented it have been retired — see
> **What left, and where it went** below. Nothing here is a browser artifact any more.

## The token contract lives in Swift, not in this folder

`apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign/` **is** the contract: the colour
roles, Apple's macOS type scale, spacing, radii, elevation and motion, each a value with a
documented reason. Tokens only — the shared views drawn with them are `ArgoAtoms`, and a
surface's own measures live in that surface's directory under `Shell/`. `rules/design-system.md`
lists all three populations by file. `ArgoUI/Specimen/ContractSpecimen.swift` is the
contract's living specimen — every role enumerated on the surfaces it is read against:

```sh
cd apps/macOS && ARGO_SPECIMEN=contract sh scripts/screenshot.sh out.png
```

It replaces the deleted `foundations.html`, and it is good at that job for the same reason the
page was: it renders the real tokens rather than a copy, so it cannot drift. It is the one
non-disposable design artifact (`rules/designs.md`).

**It cannot go partial, either.** Each role group's `all` array is what the specimen iterates,
and a `Mirror`-based assertion in `VisualContractTests` fails the build if a stored role is
missing from its array. That guard exists because the gap was real: the specimen once drew four
of six groups and none of the text inks, which is how a lavender `code` ink shipped without ever
being looked at.

Do not confuse it with **`FoundationSpecimen.swift`** (`ARGO_SPECIMEN=foundations`), which
dresses the same roles onto a real `NavigationSplitView` — the judgement of whether the contract
holds up *in a shell*. It looks like the cockpit because it is one; that is not a bug.

A surface that needs a value the contract lacks marks it a **proposal**; promoting one is a
contract change, and `scripts/check-design-tokens-swift.sh` is the gate that stops a raw
constant from quietly becoming a value nobody chose.

## The approved visual target

Every visual implementation session must read, in order:

1. parent migration issue [#373](https://github.com/milad-alizadeh/argo/issues/373);
2. its assigned child ticket;
3. [`cockpit-visual-identity-decisions.md`](cockpit-visual-identity-decisions.md) — decisions
   D1–D46, reconciled with the SwiftUI runtime;
4. [`cockpit-sessions-liquid-glass.png`](cockpit-sessions-liquid-glass.png) — the approved
   pixels; and
5. for the minimap, [`cockpit-xcode-minimap-reference.png`](cockpit-xcode-minimap-reference.png).

The PNG is load-bearing rather than illustrative: the decision log carries no measurements, so it
was the only source for the Instrument Deck's zone heights, and `ArgoLayout.swift` cited it by
name. **It no longer sets the deck's chrome.** #693 deleted the 56pt identity band that
measurement was for, and
[`cockpit-session-header.md`](cockpit-session-header.md) supersedes it there. The PNG stands for
everything else it shows.

**The sidebar is native Liquid Glass, not a dark fill.** The project strip and the Sessions
roster share one continuous system-material column that paints no background of its own (D2,
D3, D14). If a shell or roster screenshot shows a flat graphite plane behind the rows, the
material is missing — that is a defect to fix, not the look. Verify it over a non-uniform
wallpaper with the window moving; a shot against a solid desktop proves nothing.

The repository copies on `main` are canonical. Chat history, generated-image messages, local
attachments, issue edit history, and files outside the repository are not implementation
sources. When a later explicit decision changes the direction, update this bundle and the
affected child ticket in the same change, so a fresh session never needs the original
conversation.

## The specs

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157) remains the source of
> truth for cockpit UX and information architecture.** The visual handoff above supersedes its
> Penumbra look and its Electron implementation posture; its UX and IA stand.

**[`cockpit-spec.md`](cockpit-spec.md) is the front door.** It states what the cockpit is in one
document — shell, the three rooms, onboarding, status vocabulary, degradation, failure policy,
out-of-window attention, and the architecture the domain model forces — and cites the
per-surface docs for the detail rather than restating them. Read it before any row below: the
amendments that live only in closed issue comments (#201, #202, #178's audit) are applied
**inline**, so the assembled read is the current read.

The domain model is **not** here: it lives in `CONTEXT.md` at the repo root, with ADRs 0013–0018
under `docs/adr/`.

| File | Screen | Notes |
|---|---|---|
| `cockpit-visual-identity-decisions.md` | **Approved replacement-identity brief** | D1–D46 behind the locked study: material hierarchy, typography, status colour, motion, feed disclosure, native-glass boundaries, delight, migration, and deletion gates |
| `cockpit-sessions-liquid-glass.png` | **Approved Sessions visual target** | Native sidebar, graphite Instrument Deck, two bounded Liquid Glass control vessels, cleaned feed, refined minimap, attached Dock. The replacement pixels, and the only source for the deck's measurements |
| `cockpit-xcode-minimap-reference.png` | **Minimap visual grammar reference** | Xcode's clear micro-line silhouettes, indentation, restrained semantic colour, viewport wash. Reference for #382's proportions and legibility — not its light theme or literal source content |
| `cockpit-spec.md` | **The assembled contract** (wayfinder #157 Phase 1, via #253/#254) | The front door above. Every row below is its detail of record |
| `cockpit-app-shell-spec.md` | App shell (wayfinder #172, amended by #201 and #202) | Canonical chrome (merged top bar, borderless strip, global git control, connection-chip placement), room tabs, the ⌘K/keyboard model, and Project Settings (= #165's connect panel re-entered) |
| `cockpit-code-room-spec.md` | Code room spec (wayfinder #183) | The light-IDE surfaces: file explorer, editor, scratch terminal, git chrome. Third top-level room, `Code ⌘3` |
| `cockpit-failure-states-spec.md` | Failure states (wayfinder #173) | Cross-cutting policy for when a fact goes bad mid-flight: staleness as its own axis, the connection chip, pessimistic writes, real-output-not-paraphrase |
| `cockpit-onboarding-spec.md` | Onboarding (wayfinder #165) | Two screens, three independent connect rows, folder-not-repo floor, device-flow sign-in, seven states |
| `cockpit-status-vocabulary.md` | The canonical status-word registry (wayfinder #174, amended by #173) | One word per state, identical everywhere. Argo-owned words (session · attention · delivery · check · connection) vs provider-owned Ticket status shown verbatim |
| `cockpit-surface-matrix.md` | The surface × state matrix | Every cockpit surface and the states it must render — the testable spec the app is checked against |
| `cockpit-session-composer.md` + `composer/` | **Approved composer design** (#536, under #535 / ADR-0024) | The composer that replaces the Session terminal, its attachment chips, the run-settings popover and the Permission prompt. Twenty-one state renders in `composer/` are the spec; the doc carries the measurements and the frozen component names |
| `cockpit-composer-picker.md` + `composer-picker/` | **Approved command-menu design** (#590, under #535) | How a skill, a command or a file is reached from the composer: the menu `/` opens over the vessel, the `@` file menu, and the two-row `AddMenu` behind the footer's `+`. A **menu, not glass** — D14 rations glass away from a surface hanging off the field. Twenty state renders in `composer-picker/` are the spec; the doc carries the measurements, the frozen names and the `AttachButton` → `AddButton` rename |
| `cockpit-composer-picker.inventory.md` | Command-menu build inventory | What #685's build actually extracted from that design — `CommandMenu` and its three parts, the cursor and the derive — what stayed in `SessionComposer`, and the one thing the renders exposed that the design could not: the list is counted, not capped |
| `cockpit-session-composer.inventory.md` | Composer build inventory | What each ticket's build actually extracted from the design, one row per component, appended per ticket — #538 (send) so far |
| `cockpit-feed-working.md` + `working/` | **Approved in-flight design** | What the feed draws while a Session is `running`: the ion across a pending call's type, the thread across the measure while thinking, and the rule that only ever one of them shows. Four renders in `working/` are the spec; the doc carries the measurements and the seven contract changes it needs. **The feed's one loop**, under D12's live-operational-signal bound — and not D13's `Ion Trace` |
| `cockpit-feed-working.inventory.md` | In-flight build inventory | What each ticket's build actually extracted from that design, one row per component, appended per ticket — #615 (a call in flight) and #616 (thinking) so far, plus the contract values each promoted |
| `cockpit-session-header.md` + `header/` | **Approved two-row header design** (#696) | The deck's chrome cut from three rows to two: the title in the titlebar's centre, the instruments on the tab line's trailing edge, the identity band deleted. Six renders in `header/` are the spec; the doc carries the measurements and the three places the shipped components supersede the prototype |
| `cockpit-session-header.inventory.md` | Two-row header build inventory | What each ticket's build actually extracted from that design — `TabLineInstruments` for #693 so far, plus what stayed inline and what was only reseated |
| `cockpit-roster-turn-clock.md` + `roster-clock/` | **Approved Turn-clock design** (#618) | How long a Turn has been running, read in the roster row's age slot: a live `4m 12s` in `state.running` for a managed Session, `output 12s ago` for an observed one, the seen reading otherwise. The header and feed stay silent. Three renders in `roster-clock/` are the spec |
| `cockpit-roster-turn-clock.inventory.md` | Turn-clock build inventory | What #678's build actually extracted from that design — `RosterTurnClock` and the phrase it shares with the projection — and the splits that stayed inline |
| `cockpit-feed-ask.md` + `feed-ask/` | **Built ask design** (#712) | How a Session's question gets answered: in the feed row where it was asked, options pressable, one click the whole answer. **There is no vessel** — the composer's slot is not involved and `DeckVessel.resolve` gains no case, which reverses #712's own first proposal. Six renders in `feed-ask/` are the spec; built in `8188bad7`, so the code and its specimens are now truth for what shipped |
| `cockpit-work-room.md` + `.html` + `work-room/` | **Approved Tickets-room design** (#609, under #607) | The room #376's shell had a tab for and nothing behind. The sidebar is NOT the backlog: it holds views at 280 plus the Next-up hero, and the backlog moves into the deck as a 520pt disclosure tree with priority over its roots, the ticket beside it. Mail's toolbar placement, one Liquid Glass material on every vessel, `Start` naming the command it will send and going to the Session it starts (#899), both room-level vacancies, and the Route re-skinned onto graphite/Ion with #334's geometry untouched. Thirteen state renders in `work-room/` are the spec; the `.html` is the same room explorable by `?state=`; the doc carries the measurements, the frozen names and the one proposed role |
| `cockpit-work-room.inventory.md` | Tickets-room build inventory | What each ticket's build actually extracted from that design, one row per component — #812 (the views sidebar, the flat backlog and the ticket), #815 (the fact strip, the Delivery chips and the one link list) and #817 (the Next-up hero), plus what stayed inline, the `sessionTitle` role it promoted, the three places the design's own names and counts do not match the contract, the six honesty calls #815 had to make where the explorable knew more than Swift can, and the three claims the hero refuses to make |
| `cockpit-feed-ask.inventory.md` | Ask build inventory | What #712's build actually extracted from that design — the four frozen names, the held-answer value the settle rule forced out, and the keycap a second caller promoted — plus what stayed inline |
| `cockpit-roster-archive-foot.md` | **The roster's `Archived (n)` foot** | The one disclosure at the foot of the Sessions roster: anatomy, states, motion, keyboard, and the SwiftUI mechanic that stops the sidebar `Section` drawing a second chevron |
| `cockpit-session-interior-decisions.md` | Session-interior decision log | Roster rows, dot-carries-state, zero-state, panel natures. Behaviour lineage; its master–detail *layout* was superseded by the single feed |

## `renders/` — what the app actually drew

Screenshots produced by `apps/macOS`'s own specimen harness, one per ticket that settled a
surface. They are evidence of a landed state, not a target to build to, and they are not
baselines — nothing diffs them (AGENTS.md → *Visual verification*). Regenerate with:

```sh
cd apps/macOS && sh scripts/specimens.sh <dir> [name …]
```

## `prototypes/` — throwaway, and deliberately so

Studies written to answer one design question by being *looked at*. They are **not** part of the
design set: no tests, no abstractions, one file each, and every value transcribed from the Swift
contract rather than invented. A prototype belongs on a throwaway branch once the design it fed
is approved — it is a primary source to re-explore from, never a thing to build from.

| File | Question it answered |
|---|---|
| `roster-header-prototype.html` | What should the Sessions roster row and the Session deck header show? (#502) |
| `ask-vessel-prototype.html` + `.md` | How does a Session's question get answered? (#712) — settled by `cockpit-feed-ask.md` |
| `work-room-prototype.html` + `.md` | What does the Tickets room look like in the Liquid Glass shell? (#609) — settled by `cockpit-work-room.md`; the four rejected rooms stay switchable on the branch (`?variant=A|B|C|E`) |

## What left, and where it went

The HTML studies, `tokens.css`, `foundations.html`, `kit.js`, `study-template.html` and
`cockpit-ui-inventory.md` were retired with the Electron cockpit. They described a React
renderer and a CSS custom-property contract that no longer exist: `tokens.css` `@import`ed a
stylesheet inside `apps/desktop`, `foundations.html` rendered that stylesheet's values back to
itself, and the inventory named `data-component` names in renderer slices. Their successors are
the Swift `ArgoDesign` contract and `FoundationSpecimen` above.

Git history keeps all of them. `git log --diff-filter=D -- docs/designs/` finds the commit that
removed one.
