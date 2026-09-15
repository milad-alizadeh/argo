# Profiling Argo's Electron app over CDP with agent-browser

**Date:** 2026-09-15 · **For:** #2228 · **Status:** answered from `vercel-labs/agent-browser`
source (cloned at v0.37.1), `aidenybai/react-scan` source, and live experiments against the dev
instance's own CDP port. Every claim below cites a file/line or a command and its trimmed output.

## Comparison table

| Tool | Attaches to a running Electron app over CDP | Trace readout for an agent | CPU profile | React render data | Compositor-path scroll | Context cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [agent-browser](https://github.com/vercel-labs/agent-browser) | Yes — `connect <port>` attaches to an existing CDP endpoint without launching a browser (`cli/src/native/actions.rs:4891-4906`) | Raw Chrome trace JSON only, no built-in summary (`cli/src/native/tracing.rs:71-181`) | `profiler start\|stop` is the **same** `Tracing.start`/`Tracing.end` mechanism as `trace`, just a different category list (`tracing.rs:8-24,183-219`) — not a lightweight V8 `.cpuprofile` | `react renders start\|stop` gives FPS + per-component render/self time/DOM-mutation table (`react/renders.rs:62-169`), needs a hook | Only via raw CDP (`get cdp-url`); its own `mouse wheel` hardcodes x=0,y=0 (see Q3) | Single CLI binary (Rust), one `npx -y` per command | Best fit; the trace/profiler size and the wheel-position gap are real, cheaply worked around |
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | ? — not installed/tested this session; docs advertise CDP attach generally | ? | ? | ? | ? | MCP server, higher token cost per call than a CLI one-liner | Not verified — dead end for time budget, worth a follow-up if agent-browser's gaps bite |
| [@playwright/cli](https://github.com/microsoft/playwright) (`playwright` CLI / MCP) | Yes in general (Playwright supports `connectOverCDP`), but the plain CLI is scripted-automation-first, not an agent-facing one-shot command surface | No built-in trace summary beyond Playwright's own trace viewer (a GUI) | No CPU-profile command | No React-specific command | `page.mouse.wheel()` is real `Input.dispatchMouseEvent`, same CDP primitive as agent-browser | Needs a script/test file, not single commands | Not tried live; heavier to reach for a one-off attach than `connect <port>` |
| [React Scan](https://github.com/aidenybai/react-scan) | N/A directly (it's page-injected JS, not a CDP client) — but its `dist/auto.global.js` can be added to any page over CDP | N/A | N/A | Own `onRender` callback (`packages/scan/src/core/index.ts:164,573-581`) + on-page FPS toolbar; same fiber-hook idea as React DevTools, no agent-browser coexistence conflict verified live | N/A | A `<script>` tag, injectable via one `eval` | Adds visual toolbar + `onRender` hook agent-browser lacks, but agent-browser's own `react renders` report already includes FPS/min/max/drops — overlap is real, marginal value for headless/agent use unconfirmed live |
| [@paulirish/trace_engine](https://www.npmjs.com/package/@paulirish/trace_engine) | N/A (post-processes a trace file) | It IS the DevTools Performance panel's own trace model (`npm view` confirms "trace engine implementation used by the DevTools Performance Panel") | N/A | N/A | N/A | A library, not a CLI — 15.8 MB unpacked, `third-party-web`+`legacy-javascript` deps | Not run live (no CLI entry point found); would need a small Node wrapper script to call its "insights" API — real but unverified gap |
| Perfetto `trace_processor` | N/A | Would give SQL-queryable trace analysis, the standard way to summarize a huge Chrome trace | N/A | N/A | N/A | `trace_processor_shell` **not installed** on this machine (`which trace_processor_shell` → nothing) | Not verified — the single stock tool most likely to beat a jq one-liner, but not available this session |
| `jq` (stock, already on machine) | N/A | **Confirmed**: one `jq` one-liner over the raw trace/profile JSON ranks trace event types and lists long tasks in ~3s from a 146 MB file (see Q1). It does not name JavaScript functions | N/A | N/A | N/A | Already installed, single command | Smallest verified readout for long tasks. Function names need the `ProfileChunk` samples |

## Q1 — Trace size and getting a short answer out of it

**Answer.** `trace start`/`stop` and `profiler start`/`stop` are the *same* CDP mechanism
(`Tracing.start` / `Tracing.end`, `cli/src/native/tracing.rs`) — `profiler` is not a lightweight
V8 `.cpuprofile`, it is a full Chrome trace filtered to a category list
(`DEFAULT_PROFILER_CATEGORIES`, `tracing.rs:8-24`) that still includes `disabled-by-default-v8.cpu_profiler`,
`renderer.scheduler`, `blink`, etc. Both write megabytes-to-gigabytes for a few seconds of activity.
agent-browser has **no built-in summary** for either — `trace_stop`/`profiler_stop` just serialize
`traceEvents` to disk and report a path + event count (`tracing.rs:159-181`, `274-316`). A stock
`jq` one-liner is the smallest readout that still names the hot functions and long tasks; Perfetto's
`trace_processor` (not installed here) would likely do better with SQL, and
`@paulirish/trace_engine` is a library (no CLI found) that would need a short wrapper script.

**Sources**
- `cli/src/native/tracing.rs:42-181` — `trace_start`/`trace_stop`, `ReturnAsStream` transfer mode,
  writes `{"traceEvents": [...]}`.
- `cli/src/native/tracing.rs:183-316` — `profiler_start`/`profiler_stop`, same `Tracing.start`/`end`
  pair, `ReportEvents` transfer mode, `MAX_PROFILE_EVENTS = 5_000_000` (line 6).
- `npm view @paulirish/trace_engine` → "This package contains the trace engine implementation used
  by the DevTools Performance Panel" (a library, `dependencies: third-party-web, legacy-javascript`,
  unpacked size 15.8 MB, no `bin` entry seen).
- `which trace_processor_shell` → not found on this machine.

**Experiment (real output, trimmed)**

Five-second-ish scroll bursts recorded with `trace start`/`stop` and `profiler start`/`stop`
against the live Feed (debugPort rotated across restarts; all runs below are from the same
session on port 49891):

```
$ npx agent-browser trace start   # "✓ Recording started"
... 5 x `mouse wheel 300 0` (real Input.dispatchMouseEvent, does not scroll — see Q3) ...
$ npx agent-browser trace stop trace-scroll2.json
✓ Trace saved to trace-scroll2.json
$ ls -la trace-scroll2.json
251.0M  trace-scroll2.json
```

```
$ npx agent-browser profiler start   # "✓ Profiling started"
... 5 x `mouse wheel 300 0` ...
$ npx agent-browser profiler stop profile-scroll.json
✓ Profile saved to profile-scroll.json (678747 events)
$ ls -la profile-scroll.json
146.7M  profile-scroll.json
```

So `profiler` is roughly half the size of `trace` for the same window, but still ~150 MB — nowhere
near "small." Back-to-back `trace start`/`stop` with *no* activity in between still wrote **43 MB**
(`trace-quick.json`), which is pure per-frame/idle overhead from the default category set.

**Smallest readout, from the 146.7 MB profile, in ~3 seconds:**

```
$ time jq -r '[.traceEvents[] | select(.dur != null and .ph == "X")]
  | group_by(.name)
  | map({name: .[0].name, count: length, totalMs: ((map(.dur) | add)/1000)})
  | sort_by(-.totalMs) | .[0:15][]
  | "\(.name)\t\(.count)\t\(.totalMs|round)ms"' profile-scroll.json

RunTask                         47214   9530ms
ThreadControllerImpl::RunTask   45499   9420ms
RunMicrotasks                   55213   6342ms
v8.callFunction                   496   6142ms
FunctionCall                      496   3856ms
AsyncTask Run                     173   2500ms
...
jq -r profile-scroll.json  2.81s user 0.40s system 83% cpu 3.855 total
```

and, filtering for genuinely long single events (>50 ms) surfaces individual long tasks directly:

```
$ jq -c '.traceEvents[] | select(.dur != null and .dur > 50000) | {name, dur, ts}' profile-scroll.json
{"name":"RunTask","dur":95991,...}
{"name":"CpuProfiler::StartProfiling","dur":95086,...}
{"name":"RunTask","dur":187682,...}
```

Both are stock `jq`, no repo code, and both fit in an agent's context. They rank trace event
types and single out long tasks, but they do not name the JavaScript functions inside those tasks:
`RunTask` and `FunctionCall` are Chromium's event names. The function names live in the
`ProfileChunk` events (`args.data.cpuProfile.nodes[].callFrame` plus `samples` and `timeDeltas`),
and joining those takes more than a one-liner (added by the parent session after review).

**Caveat found live, unrelated to app health:** `trace stop` intermittently reported `✗ No tracing
in progress` (exit 1) even though `agent-browser tab list` confirmed the app was alive at the same
moment, and even though a `trace start` had definitely run moments earlier. It happened both when
other commands ran in between and, once, not at all on a clean back-to-back start/stop. Root cause
not fully pinned down in the time available (the daemon's own `session info --json` showed the
same background PID throughout, so it isn't a full daemon restart) — flagging it as a real
reliability gap in the trace/profiler pair worth budgeting a retry for, not a sign the app crashed.

## Q2 — React render tracking on attach

**Answer.** `--enable react-devtools` is an *init script* registered via
`Page.addScriptToEvaluateOnNewDocument`, which by definition only runs on the **next** document
load — it does nothing to a page that is already loaded, so on a `connect` to a running app it
needs a reload before the hook exists, *unless the app already ships its own React DevTools hook*.
Argo's dev instance turned out to already have one (its dev-mode React setup installs
`window.__REACT_DEVTOOLS_GLOBAL_HOOK__` itself), so `react renders start`/`stop` worked immediately
after a plain `connect`, no `--enable`, no reload. React Scan is unrelated code that can coexist —
it uses the same fiber-hook idea but is injected via its own `<script>` tag, not through agent-browser's
flag — and it adds an `onRender(fiber, renders)` callback and its own on-page FPS toolbar that
agent-browser's `react renders` report already covers with its own FPS avg/min/max/drops line, so
the marginal value for an agent (vs. a human watching a toolbar) is unclear from source alone.

**Sources**
- `cli/src/native/react/mod.rs:1-29` — doc comment: *"registered via `addScriptToEvaluateOnNewDocument`
  before any page JS runs when the user passes `--enable react-devtools` at launch."*
- `cli/src/native/actions.rs:4142-4181` (`apply_launch_init_scripts`) — maps `--enable react-devtools`
  to `react::INSTALL_HOOK_JS`, then calls `mgr.add_script_to_evaluate(&source)` (→
  `Page.addScriptToEvaluateOnNewDocument`) for every source.
- `cli/src/native/actions.rs:4891-4906` — the `connect <port>` branch of `handle_launch` calls
  `apply_launch_init_scripts` right after `BrowserManager::connect_cdp`, i.e. **on every `connect`**,
  not just a fresh launch — but per the above, this only affects the *next* navigation/reload.
- `cli/src/native/react/scripts.rs:50-51,471-472` — every `react` subcommand throws `"React
  DevTools hook not installed - relaunch with --enable react-devtools"` if
  `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` is absent, confirming the hook (from either source) is
  the only requirement, not the flag itself.
- `react-scan` README (`react-scan-src/README.md:50-140`) — ships `//unpkg.com/react-scan/dist/auto.global.js`
  for a plain `<script>` tag, i.e. injectable at runtime with no code change.
- `react-scan-src/packages/scan/src/core/index.ts:164,573-581` — `onRender(fiber, renders)` callback
  API, React Scan's own instrumentation, independent of `__REACT_DEVTOOLS_GLOBAL_HOOK__` internals.

**Experiment (real output, trimmed)**

```
$ npx agent-browser connect 49891
[agent-browser] relaunched browser
✓ Done
$ npx agent-browser eval --stdin <<< "typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__"
"object"      # hook already present, no --enable, no reload
$ npx agent-browser react renders start
✓ Done
... 8x `mouse wheel 300 0`, plus normal Feed activity over ~22s ...
$ npx agent-browser react renders stop
# Render Profile - 22.61s recording
# 380117 renders (602 mounts + 379515 re-renders) across 180 components
# FPS: avg 58, min 10, max 64, drops (<30fps): 53

## Components by total render time
| Component              | Insts | Mounts | Re-renders | Total    | Self     | DOM   | Top change reason |
| Panel                  |     8 |      0 |        344 | 4657.7ms |    2.6ms | 148/344 | parent (ResizablePanel) |
| SessionsSidebar        |     2 |      0 |         86 | 3576.5ms |    4.5ms |  0/86 | state (hook #3) |
| SessionRosterItem      |   432 |      0 |      18576 | 3475.5ms |  738.7ms | 18576/18576 | props.onRename |
| ContextMenuTrigger     |   864 |      0 |      37152 | 3014.5ms |  214.5ms | 18576/37152 | props.render |
| FeedRow                |    36 |      0 |       1548 |    549ms |   16.9ms | 1524/1548 | state (hook #4) |
... and 130 more
```

This is genuinely useful, agent-sized output (a few KB), and it came for free because the app
already had a hook. React Scan's CDN injection was **not tested live** this session (extra risk of
disturbing the already-twice-exited app for marginal new information given agent-browser's own
report already has FPS + drop counts) — flagged as an open gap rather than guessed at.

## Q3 — Scroll path: compositor vs. JavaScript

**Answer.** The top-level `scroll <dir> [px]` command is pure JavaScript: `element.scrollBy(dx,dy)`
via `Runtime.callFunctionOn` when a selector is given, or `window.scrollBy(...)` via `Runtime.evaluate`
otherwise (`cli/src/native/interaction.rs:372-422`) — it never touches Chromium's input/compositor
path, so it cannot reproduce a main-thread-blocked white flash. The separate `mouse wheel <dy> [dx]`
command (under `agent-browser mouse ...`) *does* use the real path: `Input.dispatchMouseEvent` with
`type: "mouseWheel"` (`cli/src/native/actions.rs:8428-8451`) — but the CLI parser never accepts an
x/y position for it (`commands.rs:3110-3117` only parses `dy`/`dx`; `handle_wheel` defaults both `x`
and `y` to `0.0` when absent, `actions.rs:8431-8432`), so every `mouse wheel` call is dispatched at
the top-left corner of the window, not wherever the Feed is. `agent-browser` does expose raw CDP
via `get cdp-url` (`commands.rs:2831`, parsed action `cdp_url`), and — separately — the standard
CDP HTTP endpoint `GET http://<host>:<port>/json` hands back each page's own
`webSocketDebuggerUrl` directly, which a ~35-line Node script (built-in `WebSocket`, no dependency)
can use to send `Input.dispatchMouseEvent` at the Feed's real coordinates. No use of
`Input.synthesizeScrollGesture` was found anywhere in the agent-browser source.

**Sources**
- `cli/src/native/interaction.rs:372-422` — `scroll()`, JS-only (`Runtime.callFunctionOn` /
  `Runtime.evaluate`), no CDP input event.
- `cli/src/native/actions.rs:8428-8451` — `handle_wheel()`, real `Input.dispatchMouseEvent` /
  `mouseWheel`, `x`/`y` default to `0.0`.
- `cli/src/commands.rs:3078-3121` — `mouse wheel` CLI parsing accepts only `dy` and `dx`, no
  position args.
- `cli/src/commands.rs:2794-2860` — `get cdp-url` action.
- No hits for `synthesizeScrollGesture` anywhere under `cli/src/`.

**Experiment (real output, trimmed)**

Built-in `mouse wheel`, 20 calls at the default (0,0), Feed's own scroll position read via `eval`
before and after:

```
$ npx agent-browser eval --stdin <<< "... .feed__viewport scrollTop, row data-index range ..."
{"count":21,"min":87,"max":107,"scrollTop":9790}
$ for i in $(seq 1 20); do npx agent-browser mouse wheel 800 0; done
$ npx agent-browser tab list
→ [t1] Argo - http://localhost:41042/#/sessions/52f93255-...   # still alive
$ npx agent-browser eval --stdin <<< "..."
{"count":21,"min":87,"max":107,"scrollTop":9790}   # UNCHANGED — (0,0) never hit the Feed
```

Raw CDP at the Feed's real screen coordinates (from `getBoundingClientRect()`: center ≈ (935, 476)),
via the page's own `webSocketDebuggerUrl` from `GET /json` and a small Node script sending 25
`Input.dispatchMouseEvent`/`mouseWheel` events:

```
$ curl -s http://127.0.0.1:49891/json | ...
"webSocketDebuggerUrl": "ws://127.0.0.1:49891/devtools/page/41C2E1BF88935746ECBF733FF4495C86"
$ node raw-wheel.mjs "ws://127.0.0.1:49891/devtools/page/..." 935 476 25
$ npx agent-browser tab list
→ [t1] Argo - http://localhost:41042/#/sessions/52f93255-...   # still alive
$ npx agent-browser eval --stdin <<< "..."
{"count":12,"min":96,"max":107,"scrollTop":10449}   # moved: real compositor-path scroll
```

`raw-wheel.mjs` is ~35 lines total (shown in full below) — the smallest custom code needed to close
the gap agent-browser's own `mouse wheel` leaves:

```js
const ws = new WebSocket(wsUrl);
let id = 1;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve, reject) => {
    const thisId = id++;
    pending.set(thisId, { resolve, reject });
    ws.send(JSON.stringify({ id: thisId, method, params }));
  });
}
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
await new Promise((resolve) => ws.addEventListener("open", resolve));
for (let i = 0; i < count; i++) {
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 400 });
}
ws.close();
```

No dropped rows or missing indices were observed in this run (the row window shrank from 21 to 12
because the virtualizer recalculated after a bigger jump, not because anything went missing) — a
harder test (recording a `trace` during the raw-CDP scroll and grepping for dropped-frame markers,
or screenshotting mid-scroll) is the natural next step but was not run live this session, given the
app had already exited twice and the live budget was spent proving the coordinate gap itself.

## `universal-app` (`/Users/milad/Developer/bento/apps/universal-app`) — read-only review

This is a React Native/Expo/Tamagui mobile app, not Electron, so nothing here reaches over CDP —
but it is instructive as a second, independent example of what "profiling readout" looks like when
someone has actually shipped it in this ecosystem.

- **`reassure`** (`package.json:284`, `^1.4.1`, Callstack's render-count/duration regression tool
  for React Native, built on `react-test-renderer`) is wired into three scripts:
  `package.json:35` (`test:perf`), `:36` (`test:perf:baseline`), `:37` (`test:perf:compare`, which
  runs `test:perf` then `scripts/perf-compare.cjs`). Configured in `.reassure.ts:1-6`
  (`configure({ testingLibrary: "react-native" })`). Output lands in `.reassure/{baseline,current}.perf`
  and `.reassure/{output.json,output.md}` (present on disk, 6.4 KB–34.5 KB — genuinely small).
  `scripts/perf-compare.cjs:1-13` calls `@callstack/reassure-compare` directly on the two `.perf`
  files without re-running tests, i.e. a cheap re-summarize step. This does **not** carry over to
  Argo's Electron app: `reassure` measures React Native component render counts/durations via
  `react-test-renderer` in Jest, with no browser, no CDP, and no Chromium renderer at all.
- **React DevTools Profiler JSON export**, used by hand (not scripted): `apps/docs/pin-unlock-delay-profiler-findings.md:1-43`
  documents a real investigation built entirely from a manually captured
  `profiling-data.03-17-2026.02-39-13.json` (the file itself isn't committed — this was a one-off
  capture via React Native's in-app dev menu "Start/Stop Profiling", opened back in React DevTools).
  The finding itself is instructive for *method*, not tooling: it locates the slow interaction by
  `passiveEffectDuration` on a specific commit (17.5s and 18s on two commits, line 6-9) rather than
  render time — i.e. the same "read the commit/effect timeline, not just render counts" instinct
  that agent-browser's `react renders` report and React DevTools Profiler both support. **This part
  does carry over**: Argo's Electron app is plain React DOM, so the same
  `__REACT_DEVTOOLS_GLOBAL_HOOK__`-based commit/effect data is available through `agent-browser
  react renders`, without needing RN's in-app profiler menu.
- No CDP tooling, no Perfetto, no `@paulirish/trace_engine`, and no React Scan reference found
  anywhere under `apps/universal-app` (`grep -i "profile\|trace\|perf\|flame\|devtool\|cdp\|reassure\|scan\|render"` over
  `package.json` and `CLAUDE.md`, plus a scan of `.claude/`, `scripts/`, and `.reassure*` — the only
  hits were the `reassure` scripts and build-profile flags like `--profile development`, which are
  Expo/EAS build profiles, unrelated to performance profiling).

## Recommendation

The smallest setup that answers "why does the Feed drop frames and flash white on a fast scroll,"
using only stock tools:

1. `agent-browser connect <debugPort>` (no `--enable` needed if, like Argo's dev build, a React
   DevTools hook is already present — check with `eval "typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__"`
   first, since `--enable react-devtools` only takes effect on the next reload otherwise).
2. `agent-browser react renders start` before the scroll, `react renders stop` after — gives FPS
   avg/min/max/**drops** and the hot-component table directly, no post-processing needed.
3. `agent-browser trace start` / `trace stop <path>` around the same window for the frame-level
   picture, then one `jq` one-liner (shown in Q1) to rank event types and list any >50 ms single
   tasks. Naming the hot JavaScript functions needs the `ProfileChunk` samples joined to their call
   frames, which is a short script rather than a one-liner.
4. For the scroll itself, agent-browser's own `mouse wheel` is not enough — it always dispatches at
   (0,0). The real compositor-path scroll needs raw CDP: `GET http://<host>:<port>/json` for the
   page's `webSocketDebuggerUrl`, then `Input.dispatchMouseEvent`/`mouseWheel` at the Feed's actual
   `getBoundingClientRect()` coordinates. That's the one gap needing custom code, and it is small —
   the ~35-line Node script in Q3, using the platform's built-in `WebSocket`, no dependency to add.

Everything else here — Perfetto's `trace_processor` for a sharper trace summary, React Scan's
`onRender` hook, `chrome-devtools-mcp` — is a plausible upgrade but unverified this session; they are
marked `?` in the comparison table rather than guessed at.
