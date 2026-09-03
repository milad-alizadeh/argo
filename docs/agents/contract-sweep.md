# Sweeping the visual contract for members nothing reads

`ArgoDesign` runs ahead of the build on purpose, so some of its members have no reader. Some
of those are decisions and some are debt, and telling them apart needs a method — a grep over type
names is not one, because it cannot see a member reached through an extension method.

```bash
node scripts/contract-readers.mjs          # the report
node scripts/contract-readers.mjs --json   # the same, for a diff between sweeps
```

`scripts/contract-readers.test.mjs` (in `bun run test:hooks`) holds the method's claims. Soften the
script and that test together, never one alone.

## What the machine does

It reads every member declared under `ArgoDesign` and looks for the **shape a call site
spells**, over every Swift file under `apps/macOS/`:

| shape | example | why it matters |
| --- | --- | --- |
| `.name` on its type | `ArgoRadius.control` | the ordinary reach |
| `.name` through inference | `argoIcon(.inline)` | no type name at the site at all |
| a bare `name(` | `argoInk(theme)` | an extension method — the one a type-name grep misses |

Inside the declaring file the name alone counts, since a type reads its own members unqualified.
Comments and string literals are stripped first: prose names roles constantly without reading one.
A self-reference on a line that also carries the member's name as a string is the family's `all`
catalog enumerating it, not a reader — otherwise nothing is ever dead.

Readers are counted in four populations, and the report turns on them:

- **app** — a surface drawing the value. One of these and the member is alive.
- **own / contract** — the contract composing itself: `ArgoTypeScale.callout` under an
  `ArgoTypography` role, `ArgoColor.red` under `.color`. Read, just not at a surface.
- **specimen / tests** — looked at, and asserted. Not drawn.

Two groups come out: **no call site anywhere**, and **read only by the specimen and its
assertions**. Everything else is alive.

The member count will not match a hand count taken off the type names. #756 counted 246; this
counts **294**, because it enumerates what a type-name pass never reaches: every `func` and `case`,
every `private` member, and every member of a nested type. A sweep is compared against the previous
sweep's JSON, never against a remembered number.

### The one thing it cannot do

Two families spell some names — `deck` is an `ArgoRadius` rung and an `ArgoElevation` rung — and
they share one count. That can only ever **keep** a member, never put one on a list wrongly, so the
sweep errs towards keeping. A member on either list marked `[shared name]` has its sites read by
hand before anything is done to it.

## What the human does

Classify each member the sweep names. `rules/swift.md` gives four answers and only one of
them is a deletion:

| category | what it looks like | what to do |
| --- | --- | --- |
| **worth zero** | `ArgoRadius.deck`, the flat `ArgoElevation` rungs — nothing reads them because you honour them by drawing nothing | keep, and say so **at the value** |
| **the system owns it** | a number that looks like a decision and cannot be honoured — the retired `ArgoRadius.vessel`, whose shape came from the toolbar's own material | delete |
| **nothing needs it** | a role a surface has taken over, or one that never had a surface. *Not every gap is a plan* | delete |
| **`unwired`** | specified ahead of its surface, listed in its family's `unwired` map with what it waits on, and drawn by the specimen in the attention ink | keep — it is already accounted for |

Two readings are neither, and the sweep's populations are how you tell:

- **A value another value is built out of** never reaches the lists at all.
- **A measure the contract's own claims are made of** — `ArgoColor.contrastRatio`,
  `ArgoElevation.castsShadow`, `ArgoMotion.durationCeiling` — is read by the suites and by nothing
  else, on purpose. It is a survivor a reader would otherwise mistake for dead, so it says at the
  value that the assertions are what spend it.

A role the **specimen alone draws** is the one case where the group is not the answer. The specimen
draws every role, including the dead ones — it is where a role is looked at, never why it is kept.
So ask what the role is FOR, and whether a shipping surface still answers to that: a role waiting
on a surface is `unwired`, and a role whose surface another role has taken over is *nothing needs
it*, whatever the specimen still does with it.

Finally, check the `unwired` maps in the other direction. `VisualContractCoverageTests` fails an
entry naming a role that does not exist; nothing fails an entry naming a role that has since
**shipped**, and such an entry has the specimen drawing a live role as unjudged.

## The sweep of #774

12 members had no call site under a type-name grep (#756). Under this method: **two**, and both
were already accounted for.

| member | category | outcome |
| --- | --- | --- |
| `ArgoElevation.flat` | worth zero | kept; the reason now sits at the value |
| `ArgoElevation.dragged` | `unwired` (drag-and-drop) | kept |
| `ArgoColor.contrastRatio` · `.chromaticSpread` · `.distance` | the measures the colour claims are made of | kept; said at the extension |
| `ArgoElevation.castsShadow` · `.glows` | the same, for `flat by default` | kept; said at the value |
| `ArgoMotion.durationCeiling` | the same, for the duration cap | kept; said at the value |
| `ArgoElevation.deck` · `ArgoRadius.deck` | worth zero | kept; both already said so |
| `ArgoElevation.unwired` · `ArgoMotion.unwired` · `ArgoTypography.unwired` | the mechanism itself | kept |
| `ArgoPalette.SurfaceRoles.ramp` · `ArgoPalette.ramps` | the catalogs the specimen and the assertions walk | kept; both already said so |
| `ArgoWaitAge.coldest` | the ladder's floor, stated by the specimen's caption | kept; said at the value |
| `ArgoLayout.windowIdealWidth` | **nothing needed it because the call site restated it** — `ArgoApp` spelled `defaultSize(width: 1280, height: 800)` | wired, and `windowIdealHeight` added beside it |
| `ArgoTypography.sessionTitle` | nothing needs it — #691 gave the Session's title to `windowTitle`, leaving a title role only the specimen deck drew | **deleted**; the specimen deck takes `identityHeading` |

`ArgoTypography.unwired` also named `identityHeading`, which `ConnectPanel` and `WelcomeScreen`
have shipped since. The entry is gone.
