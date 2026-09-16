# Profiling a desktop screen

You profile the dev instance with the agent-browser CLI, which attaches to its loopback debugging
port. Two small files fill the gaps that agent-browser leaves:

- `scripts/profiling/scroll.mjs` flings any element through Chromium's real input pipeline.
  agent-browser's `scroll` runs a script `scrollBy`, and its `mouse wheel` always lands at (0, 0).
  Neither one scrolls the way a trackpad does.
- `scripts/profiling/hot-functions.jq` names the JavaScript functions in a CPU profile.

Every command goes over the debugging protocol, so none of them holds the real keyboard or mouse.

## Profile on request

1. Make sure that the dev instance runs. If `bun run desktop:status` fails, start `bun run dev`
   from the worktree root as a background command. Wait until the status command prints a record
   with a `debugPort`. A record without one comes from an older instance: stop it with
   `bun run desktop:stop` and start it again.
2. Run `npx -y agent-browser@0.37.1 connect <debugPort>`. The dev build installs the React
   DevTools hook itself, so the page needs no reload.
3. Open the screen that the reader named, with the `snapshot` and `click` commands of
   agent-browser. Keep the app window uncovered while you record. Chromium throttles a covered
   window.
4. Record the gesture with one of the two recorders below. Start with the render recorder.
5. Name the bottleneck. You are done when you can name the component or the function that costs
   the frames, and cite the report line for it.
6. After a fix, record the same gesture on the same screen 3 times, and compare the best run with
   the best run from before. Another process only ever makes a run slower.

## The gesture

```sh
node scripts/profiling/scroll.mjs --port <debugPort> [--up] [--distance 20000] [--speed 6000] '<selector>'
```

The script flings at the center of the visible part of the first element that matches. It prints
the `scrollTop` of the nearest element that scrolls, before and after. If the two values are the
same, nothing scrolled: pick another selector. The Feed of the open Session is
`.feed__document[data-active="true"] .feed__viewport`, and it starts at the bottom, so its first
fling takes `--up`.

A hard trackpad fling reaches about 20000 px/s. If the reader reports a flash that 6000 px/s does
not show, raise `--speed` before you conclude that nothing is wrong.

## The render recorder

```sh
npx -y agent-browser@0.37.1 react renders start
# the gesture
npx -y agent-browser@0.37.1 react renders stop
```

The report gives the FPS (average, minimum and drops under 30) and a table of components by
render time. The table gives the re-render count and the top change reason for each component. A
component that re-renders during a gesture that does not concern it is a finding by itself. A
drop is a frame under 30 FPS, not a missed refresh of the display, so compare the minimum FPS as
well.

## The CPU recorder

```sh
npx -y agent-browser@0.37.1 profiler start
# the gesture
npx -y agent-browser@0.37.1 profiler stop <file>
jq -r -f scripts/profiling/hot-functions.jq <file>
```

Write the file to a temporary directory: one fling writes about 100 MB.

The output ranks functions by self time. A file under `main-*.js` or `node:` runs in the Electron
main process, and a Vite URL runs in the renderer. Use `profiler` and not `trace`: `trace` records
no CPU samples. Delete the file when you are done.

If `profiler stop` prints `No tracing in progress` while the app still runs, start the recording
again.

## A packaged journey

Run the portable Session journeys with a CPU profile and per-case wall times:

```sh
bun run --cwd apps/desktop test:journey-profile
```

The run prints a temporary `journey-cpu-trace.json` and `journey-timings.json`. Read the CPU trace
with the same function report as the dev instance:

```sh
jq -r -f scripts/profiling/hot-functions.jq <journey-cpu-trace.json>
```

The trace contains renderer work, including React rendering, and the timings file lists the wall
time for every journey case. It makes no performance assertion: compare runs on the same machine.
Delete the temporary directory when you are done.

## Dev-only noise

The dev build pays for React's development mode. Discount these entries before you name a
bottleneck:

- `measure`, which is React's performance tracks.
- `jsxDEV` and `ReactElement` from `react_jsx-dev-runtime.js`.
- Script sources under `/node_modules/.vite/deps/`, which are unminified dev bundles.

A white flash with no dropped frames means that the list mounts too few rows ahead for the speed.
The main thread is then not at fault.
