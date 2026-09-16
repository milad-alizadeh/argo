# Are Argo's Playwright proofs written the way Playwright says to write them?

**Date:** 2026-09-16 · **For:** an audit of the desktop packaged proofs against the official
Playwright documentation · **Status:** answered from this repo's source at `5ba779ab4`, the
installed `playwright-core@1.63.0` type declarations, and playwright.dev. Every claim below cites
a repo path with line numbers or a docs URL plus its heading.

## The answer

**Mostly yes on the practices that decide whether a test is honest, and structurally no on the
practices that decide whether a failing test is diagnosable.**

The locator discipline is better than most Playwright *test-runner* suites: 98 `getByRole` calls
against 56 raw `.locator(css)` calls, real clicks and real typing through the composer, and fakes
placed only at the CLI and HTTP boundaries. That is exactly what
[Best Practices · Test user-visible behavior](https://playwright.dev/docs/best-practices) and
[Locators · Locate by role](https://playwright.dev/docs/locators) ask for.

What is missing is everything the **test runner** would have supplied and nobody re-built: there is
no test isolation, no retry, no trace, no artifact on failure, no parallelism, and no auto-retrying
assertion. The three packaged proofs are single top-level scripts in which ~19 cases share one
Electron process, one temp root and one mutable `page` variable, in an order the comments themselves
admit is load-bearing (`prove-session-feed.ts:118`, `:122`). Each proof is therefore one test, not
nineteen; a failure at case 12 tells you nothing about cases 13-19, and the run leaves behind a
JSON line and a 50-entry console ring buffer instead of a trace.

Two findings are outright defects rather than style: the Project proof prints case names it never
ran, and three files in the Project proof tree are dead.

## Inventory

Every Playwright call site in the repository. `playwright-core@1.63.0` is a devDependency of
`apps/desktop` only (`apps/desktop/package.json:82`); the root manifest names no Playwright
package at all.

| Path | What it drives | How it runs | In CI? |
| --- | --- | --- | --- |
| [`src/core/sessions/fake-driver/packaged-session-harness.ts`](../../apps/desktop/src/core/sessions/fake-driver/packaged-session-harness.ts) + [`prove-session-feed.ts`](../../apps/desktop/src/core/sessions/fake-driver/prove-session-feed.ts) + ~35 case files | Packaged `Argo.app`, `_electron.launch`, first window kept hidden | `bun run test:packaged-session` → `bun build` to `scripts/session-fake-driver/prove-session-feed.mjs`, run by `node` | Yes — `.github/workflows/ci.yml:366-372`, macOS job, path-filtered |
| [`src/core/tickets/fake-driver/ticket-proof-fixture.ts:86-113`](../../apps/desktop/src/core/tickets/fake-driver/ticket-proof-fixture.ts) + [`prove-tickets.ts`](../../apps/desktop/src/core/tickets/fake-driver/prove-tickets.ts) | Packaged app with `--use-mock-keychain`, against a fake GitHub and fake Linear on loopback | `bun run test:packaged-tickets` | Yes — `ci.yml:376-379` |
| [`src/core/projects/fake-driver/prove-project-contract.ts:116-120`](../../apps/desktop/src/core/projects/fake-driver/prove-project-contract.ts) | Packaged app; asserts the preload surface and that the store is untouched | `bun run test:packaged-project` | Yes — `ci.yml:359-362` |
| [`src/core/projects/fake-driver/project-proof-fixture.ts:62-68`](../../apps/desktop/src/core/projects/fake-driver/project-proof-fixture.ts) + [`capture-cockpit.ts`](../../apps/desktop/src/core/projects/fake-driver/capture-cockpit.ts) | Packaged app, window shown, PNG capture | `bun run capture:cockpit` | No |
| [`src/core/projects/fake-driver/measure-cockpit.ts`](../../apps/desktop/src/core/projects/fake-driver/measure-cockpit.ts) | Packaged app, 5 interleaved launches, startup/frame metrics | `bun run measure:cockpit` | No — human-judged on the reference Mac |
| [`scripts/render-desktop-state.mjs:4,13`](../../apps/desktop/scripts/render-desktop-state.mjs) | `chromium.launch()` → a Storybook iframe → one PNG | `bun run design:render` | No |
| [`vitest.config.ts:4,22`](../../apps/desktop/vitest.config.ts) | Chromium, via `@vitest/browser-playwright`, for Storybook stories in both themes | `bun run test:storybook` | Yes — `ci.yml:129-165`, Linux |

**Looked for and not found.** No `playwright.config.*` anywhere outside vendored
`node_modules/cytoscape`. No `*.spec.ts`, no `e2e/` directory, no `test.describe`, no `test()` from
Playwright. `@playwright/test` is present under `node_modules` only transitively, pulled by
`@vitest/browser-playwright`; nothing imports it. **There is no Playwright test-runner suite in this
repository** — Playwright is used purely as a driver library.

**Dead ends, said plainly.**

- `apps/desktop/scripts/render-design-page.mjs` is *not* Playwright. It drives Electron directly and
  says why at lines 9-11: "`playwright-core`'s Electron launcher waits on a handshake that a
  one-window script never completes."
- `apps/desktop/scripts/prove-packaged-pty.mjs` / `packaged-app.mjs` launch the packaged binary with
  `child_process.spawn` (`packaged-app.mjs:3,24`) and read its stdout. No Playwright.
- `src/core/sessions/fake-driver/stalled-feed-repro.ts` drives the main-process reader with
  `spawn`, no browser. Deliberately red, run by no gate (its own header, lines 1-10).
- `src/agents/claude/session-fake-driver/prove-message-display.ts` (`test:live-claude-display`)
  spends a real Turn on the subscription but never opens a window. No Playwright.
- `apps/desktop/scripts/fuse-profile.mjs:17` mentions Playwright only in a comment (the inspector
  fuse it flips so Playwright can attach).
- **Dead code:** `src/core/projects/fake-driver/project-proof-contract.ts`,
  `project-proof-cockpit.ts` and `project-proof-keyboard.ts` are imported by nothing. `grep -rn` for
  each name across `src`, `scripts` and `.storybook` returns nothing but their own definitions.
  `project-proof-contract.ts:9-20` still declares a 10-method `SURFACE` that the live proof replaced
  with 53 methods (`prove-project-contract.ts:33-86`).

## Practice by practice

### Test user-visible behavior — followed, and unusually well

The Session proof creates a Session the way a person does: click the plus control, press the harness
tab, click into the composer, type, press Enter (`session-gestures.ts:145-159`). Its header states
the reason, and it names the bug class the shortcut hid:

> Every packaged case used to inherit its Session from an injected `window.argo.startSession()`, and
> that one uncrossed boundary is where a cluster of creation bugs reached the user.
> — `session-gestures.ts:2-4`

That is the doc's position verbatim: "Automated tests should verify that the application code works
for the end users, and avoid relying on implementation details"
([Best Practices · Test user-visible behavior](https://playwright.dev/docs/best-practices)).

### Locators — followed for controls, with a real CSS tail

Counts over the four proof trees: **98** `getByRole`, **41** `getByText`, **1** `getByLabel`,
**56** `.locator(` (all CSS), **16** `waitForSelector`, **0** `getByTestId`, **0** XPath. The
Tickets proof in particular reads like the docs' own example — `getByRole('region', {name:
'Backlog'})`, `getByRole('listitem', {name: 'GitHub Account octocat'})`, `getByRole('article', {name:
'Ticket ENG-1'})` (`ticket-proof-screen.ts:37-42`, `linear-proof-cases.ts:86`).

The CSS tail is concentrated in the Feed and is partly unavoidable — `offsetOf` and `viewportAnchor`
read `getBoundingClientRect()` geometry, which no role locator exposes
(`feed-selectors.ts:9-32`). But some of it is pure styling coupling, which the docs single out:
"XPath and CSS selectors can be tied to the DOM structure or implementation. These selectors can
break when the DOM structure changes" ([Locators](https://playwright.dev/docs/locators)). The
offenders:

- `'.feed__viewport'` — 10 sites, a BEM class.
- `'.feed__viewport .feed-row--prose'` — a *modifier* class, one rename away from silent breakage.
- `'[data-component="ChromeBar"] span'` (`cockpit-driver.ts:7`) — a bare tag inside a component.

`[data-slot=…]` and `[data-component=…]` are closer to `getByTestId` and are fine.

### Web-first assertions and auto-waiting — the largest gap

Every assertion in every proof is `node:assert/strict`. These are non-retrying by construction, and
the docs are explicit: "Most of the time, web pages show information asynchronously, and using
non-retrying assertions can lead to a flaky test"
([Assertions · Non-retrying assertions](https://playwright.dev/docs/test-assertions)).

The repo compensates by putting an explicit `waitFor()` or `waitForFunction()` before the read,
which mostly works. Where it does not is **absence**:

```ts
// session-roster-window-case.ts:42-45
assert.equal(
  await page.locator(`${ROW}[data-session-id="${FARTHEST_WINDOW_FILLER_ID}"]`).count(),
  0,
)
```

```ts
// linear-proof-cases.ts:91
assert.equal(await run.page.getByRole('button', { name: 'New Ticket' }).count(), 0)
```

```ts
// session-reply-delay-case.ts:43
assert.equal(await page.getByText(`Fake Claude read: ${prompt}`).count(), 0)
```

Each is a single snapshot of a live renderer. It passes if the element has not rendered *yet*, which
is the classic false green. `expect(locator).toHaveCount(0)` auto-retries to a timeout and is the
documented form. `assert.equal(await composer.textContent(), '')`
(`session-gestures.ts:151`) has the same shape.

`expect` lives in `@playwright/test`, which is not a direct dependency here — so this recommendation
carries a real cost, noted below.

### Manual waits — six sleeps, three defensible

`playwright-core@1.63.0`'s own declaration for `waitForTimeout` says:

> **NOTE** Never wait for timeout in production. Tests that wait for time are inherently flaky. Use
> Locator actions and web assertions that wait automatically.
> — `node_modules/playwright-core/types/types.d.ts:9057-9058`

The sleeps:

| Site | Sleep | Judgement |
| --- | --- | --- |
| `session-diagram-case.ts:105,112` | `waitForTimeout(REFLOW_SETTLE_MS)` twice, after a `waitForFunction` on pane width | A layout-settle guess. Replaceable: the geometry it is waiting for is readable, so `expect.toPass` or a `waitForFunction` on two stable frames would be deterministic. |
| `session-roster-window-case.ts:29` | `waitForTimeout(50)` inside a 40-attempt scroll loop | Scroll-to-load polling. Defensible in shape, but the loop re-implements `locator.waitFor()` plus a scroll, and its error path is buggy — the `deadline` `break` falls into the same `throw` as exhausting the attempts, so a timeout is reported as "the window stopped growing". |
| `session-feed-fixture.ts:172` | `waitForTimeout(400)` before `page.screenshot` | Shot-only path, off in CI (`ci.yml:369-371`). Harmless. |
| `session-reader-motion-case.ts:12` | `waitForTimeout(50)` between wheel ticks | Legitimately modelling human scroll cadence. Not a wait. |
| `cockpit-metrics.ts:61`, `measure-cockpit.ts:60` | `setTimeout(SETTLE_MS)` | Measurement settle, not a synchronisation wait. Fine. |
| `session-gestures.ts:139` | `setTimeout(POLL_MS)` in `waitForCreatedRow` | Justified: each poll must also run `cliWrote()` in **Node**, which `waitForFunction` cannot do. This is the one hand-rolled loop the docs' tools genuinely cannot express — though `expect.poll` expresses it exactly. |

### Actionability — deliberately bypassed in two of the three proofs

The Tickets and Projects proofs press every button with `dispatchEvent('click')`:

```ts
// ticket-proof-screen.ts:13-14
export const press = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true }).dispatchEvent('click')
```

```ts
// cockpit-driver.ts:36-40
// `dispatchEvent` rather than a real click: the proof window is never shown, and an unpainted
// window has nothing to hit-test. The component's own handler still runs.
export function press(page, name) {
  return page.getByRole('button', { name, exact: true }).dispatchEvent('click')
}
```

[Actionability](https://playwright.dev/docs/actionability) lists `locator.dispatchEvent()` with
dashes across every check column: no visible, no stable, no receives-events, no enabled, no
editable. So these proofs cannot catch a button covered by an overlay, a disabled button that still
has a handler, or a control that moved mid-click — the whole class of bug the real `click()` exists
to catch.

The comment's premise is also **contradicted by this repo's own Session proof**, which runs against
an equally hidden window (`prove-project-contract.ts:90-93` asserts `isVisible() === false` for the
same launch shape) and uses real `.click()` throughout (`session-gestures.ts:43,51,53,69,83,150`).
One of the two harnesses is wrong about what a hidden Electron window can hit-test, and the Session
proof is the one with evidence on its side.

### Test isolation — not followed, and the code says so

"Each test should be completely isolated from another test and should run independently"
([Best Practices · Test isolation](https://playwright.dev/docs/best-practices)). The Session proof
is the opposite: one `page` reassigned across 19 `ran(...)` calls, with ordering constraints written
into comments rather than into structure.

```
// prove-session-feed.ts:109-110
// Every case above reads `/Users/x` fixtures a selected Project scopes out (#2204); every case
// below starts a Session, which needs one.

// prove-session-feed.ts:118
// Last, because naming the Codex row changes the title the cases above open it by.

// prove-session-feed.ts:122-123
// Last: enough Sessions to cross the Roster's page size land only now, so no earlier case's own
// exact Roster counts or ordering has to account for them.
```

`prove-tickets.ts:44-63` is the same: `proveConnect` → `proveConnectRepository` → `proveBacklog` →
close → `outage('down')` → relaunch → seven more, each depending on the state the last left.

This is a deliberate trade — a packaged launch costs seconds, and `packaged-session-harness.ts:34-42`
exists to time them — but it should be named as the trade it is. No case can be run alone, nothing
can be run in parallel, and a mid-run failure invalidates the rest.

### Avoid testing third-party dependencies — followed, precisely

The fakes stop at exactly the boundaries the docs name. `ticket-proof-fixture.ts:1-2`: "The
providers are the one thing faked; the cockpit, its stores and safeStorage all run for real." The
CLIs are faked at the executable (`writeFakeClaude`, `writeFakeCodex`,
`packaged-session-harness.ts:48-49`), which matches the house rule that e2e stubs only the CLI.
`shell.openExternal` is stubbed in the main process because a real browser is not testable
(`ticket-proof-fixture.ts:102-111`). Nothing reaches github.com or linear.app. This is the strongest
part of the audit.

### Retries, traces, debuggability — hand-rolled and thinner than the runner's

There is **no** `tracing.start`, no `recordVideo`, no `tracesDir` and no retry anywhere in the repo
(`grep -rn "tracing\|recordVideo\|retries\|tracesDir"` over `src` and `scripts` returns one unrelated
string). What exists instead:

- a 50-line renderer console ring buffer (`packaged-session-harness.ts:19-32`),
- a DOM state snapshot printed as JSON on failure (`packaged-case-runner.ts:20-31`,
  `feed-selectors.ts:45-60`).

Both were built for #2201 and both are genuinely useful. But they are a hand-made subset of what a
trace gives free: DOM snapshots per action, network, sources, the action timeline. And the API is
available *without* the test runner — `ElectronApplication.context()` returns a `BrowserContext`
(`node_modules/playwright-core/types/types.d.ts:19073`), and
[class-Tracing](https://playwright.dev/docs/api/class-tracing) documents
`context.tracing.start({screenshots: true, snapshots: true})` / `stop({path})` against a
library-created context. The caveat the docs give — tracing "doesn't record test assertions" — costs
this repo nothing, because its assertions are `node:assert` and would not be recorded anyway.

The Tickets and Projects proofs do not even have the ring buffer. A failing `proveLinearExpired` in
CI prints a bare assertion message.

### Parallelism — absent, and mostly correctly so

"Playwright runs tests in parallel by default" ([Best Practices ·
Parallelism](https://playwright.dev/docs/best-practices)). Here, three proofs run as three
sequential CI steps (`ci.yml:359-379`), each internally serial. Given that each drives one packaged
macOS app against one temp root, and GitHub Free allows 5 concurrent macOS jobs, cross-proof
parallelism is available and within-proof parallelism is not without first fixing isolation. Low
payoff; listed for completeness.

### Fixtures and setup — good shape, wrong mechanism

`prepare(root)` / `launch(fixture)` in each tree is a fixture in everything but name, and
`packaged-session-harness.ts` even returns a closeable handle. What it lacks is the runner's
guarantee that teardown runs per test; here it is one `try/finally` around the whole script
(`prove-session-feed.ts:136-142`), so a crash mid-run leaks nothing but also cleans nothing between
cases.

### Timeouts — consistent and explicit

`timeout: 30_000` on every `electron.launch`, `page.setDefaultTimeout(30_000)` after every
`firstWindow()`, and tighter per-wait budgets where they matter
(`feed-selectors.ts:7` `REVISION_TIMEOUT_MS = 5_000`). Nothing to fix.

## Two defects, not style

**1. The Project proof prints cases it never ran.** `prove-project-contract.ts:124-132` prints:

```ts
cases: ['success', 'missing-project', 'denied-access', 'invalid-request', 'unchanged-store'],
```

The script's whole body is `prove(application)` → `proveSurface` (packaged flag, window hidden,
preload surface) plus one `readFile` comparison. `missing-project`, `denied-access` and
`invalid-request` are **never exercised in the packaged app**. They are covered by
`scripts/project-contract.test.mjs:36-89`, a `node:test` suite that calls `openProject()` in
process. The packaged proof's JSON therefore claims coverage it does not have. `prove-tickets.ts:71-99`
has the same shape — a 27-name literal list disconnected from the 13 `prove*` calls above it.

Contrast `prove-session-feed.ts`, which gets this right: `packaged-case-runner.ts:18` pushes a name
only *after* its case returns, so the printed list is the list that passed. That pattern already
exists in the repo and the other two proofs should adopt it.

**2. Three dead files in the Project proof tree**, carrying a stale contract (see Inventory). House
rules say delete dead code on sight.

## Where a best practice does not apply

Several documented practices are runner-only and are **not** failings here — but each names
something the repo pays for by hand:

| Practice | Why it does not apply | What the runner would have given |
| --- | --- | --- |
| `expect` auto-retrying assertions | `playwright-core` ships no `expect`; it is in `@playwright/test` | Retry-to-timeout on every assertion, and the absence checks above stop being snapshots |
| `retries: 2` on CI, `trace: 'on-first-retry'` | No config file, no runner | A trace zip for exactly the runs that failed, at near-zero cost on green runs |
| Parallel workers, sharding | One script, one process | Three proofs in the wall time of the slowest |
| HTML reporter | Output is one `console.log(JSON.stringify(...))` per proof | A browsable failure with the failing action highlighted |
| `beforeEach` isolation, per-test teardown | Ordered single script by design | Independent cases, runnable alone, in any order |
| `webServer` | Nothing to serve; the subject is a packaged `.app` | Genuinely N/A |
| Codegen | Hidden window, packaged app | Genuinely N/A |
| `expect.soft` | No `expect` | A run that reports all failures, not the first |

## Recommended changes, by payoff

1. **Record a trace around each packaged proof and write it on failure.**
   `application.context().tracing.start({screenshots: true, snapshots: true})` after launch in
   `packaged-session-harness.ts:56`, `ticket-proof-fixture.ts:87` and
   `prove-project-contract.ts:116`; `stop({path})` in the existing `finally`. Cite:
   [class-Tracing](https://playwright.dev/docs/api/class-tracing), and `types.d.ts:19073` for
   `ElectronApplication.context()`. This is the single highest-payoff change: it replaces the
   hand-rolled ring buffer with the real thing and gives the Tickets and Projects proofs the
   diagnostics they currently have none of.

2. **Fix the two proofs that print unearned case names.** Move `prove-project-contract.ts:130` and
   `prove-tickets.ts:71-99` onto `createCaseRunner` from
   `src/core/sessions/fake-driver/packaged-case-runner.ts:18`, which records a name only after its
   case passes. Also deletes the Tickets proof's diagnostic blind spot for free.

3. **Stop bypassing actionability in the Tickets and Projects proofs.** Replace
   `ticket-proof-screen.ts:13-14` and `cockpit-driver.ts:38-40` with `locator.click()`, on the
   evidence that the Session proof already clicks a hidden window successfully
   (`session-gestures.ts:43,51,69,83,150`). Cite:
   [Actionability](https://playwright.dev/docs/actionability) — `dispatchEvent` performs no
   visible / stable / receives-events / enabled check. If a case really cannot click, `click({force:
   true})` at least keeps the visibility and enabled checks.

4. **Add `@playwright/test` as a devDependency for `expect` alone, and convert the absence and
   text-content assertions.** `expect(locator).toHaveCount(0)` at
   `session-roster-window-case.ts:42-45`, `linear-proof-cases.ts:91`,
   `session-reply-delay-case.ts:43`; `expect(locator).toHaveText('')` at `session-gestures.ts:151`.
   Cite: [Assertions · Non-retrying assertions](https://playwright.dev/docs/test-assertions). The
   same dependency makes `expect.poll` available for `session-gestures.ts:122-141` and
   `session-roster-window-case.ts:24-33`, retiring two hand-rolled poll loops — including the one
   whose deadline `break` currently reports a timeout as the wrong error.

5. **Delete `project-proof-contract.ts`, `project-proof-cockpit.ts`, `project-proof-keyboard.ts`.**
   Imported by nothing; `project-proof-contract.ts:9-20` carries a stale 10-method surface against
   the live 53.

6. **Replace the two `waitForTimeout(REFLOW_SETTLE_MS)` calls** at `session-diagram-case.ts:105,112`
   with a wait on the geometry itself (two consecutive equal `getBoundingClientRect()` readings, or
   `expect.toPass`). Cite: `types.d.ts:9057-9058` — "Tests that wait for time are inherently flaky."

7. **Name the isolation trade in the proof headers.** `prove-session-feed.ts` and `prove-tickets.ts`
   are ordered single tests by design, for a defensible reason (packaged launch cost, timed at
   `packaged-session-harness.ts:34-42`). The ordering comments at `prove-session-feed.ts:109,118,122`
   should be joined by one header sentence saying the whole file is one test and why, so the next
   reader does not assume the cases are independent. Cite: [Best Practices · Test
   isolation](https://playwright.dev/docs/best-practices).

8. **Replace the styling-class selectors** `'.feed-row--prose'` and `'[data-component="ChromeBar"]
   span'` (`cockpit-driver.ts:7`) with `data-slot` or role locators. The geometry reads against
   `.feed__viewport` can stay; they read `getBoundingClientRect`, which no role locator exposes.
   Cite: [Locators](https://playwright.dev/docs/locators).

Items 1-4 are worth doing. Items 5-8 are cleanup.

## Where this went

The findings are tickets under [#2306](https://github.com/milad-alizadeh/argo/issues/2306), which
carries the plan and the sequencing.

| Finding | Ticket |
| --- | --- |
| Trace on failure (1) | [#2321](https://github.com/milad-alizadeh/argo/issues/2321) |
| Unearned case names (2) | [#2319](https://github.com/milad-alizadeh/argo/issues/2319) |
| Actionability bypassed (3) | [#2320](https://github.com/milad-alizadeh/argo/issues/2320) |
| Non-retrying absence assertions (4) | [#2322](https://github.com/milad-alizadeh/argo/issues/2322) |
| Dead files (5) | [#2318](https://github.com/milad-alizadeh/argo/issues/2318) |
| Isolation (7) | [#2326](https://github.com/milad-alizadeh/argo/issues/2326) |
| The runner itself | [#2325](https://github.com/milad-alizadeh/argo/issues/2325) |

Two things came out of the audit rather than out of the Playwright documentation.
[#2323](https://github.com/milad-alizadeh/argo/issues/2323) moves the in-process provider tests onto
Mock Service Worker, which patches the process it loads into and so cannot reach the packaged
application. [#2324](https://github.com/milad-alizadeh/argo/issues/2324) caches the packaged
application in turbo, which is possible because the fake CLIs are reached through environment
variables and are never inside the bundle.

Recommendation 6 (the two settle sleeps) and recommendation 8 (the styling-class selectors) have no
ticket. They are cleanup, and they wait for someone working in those files.
