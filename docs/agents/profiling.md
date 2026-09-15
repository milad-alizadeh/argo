# Profiling a desktop screen

`bun run desktop:profile -- <scenario>` drives one interaction through Chromium's own input
pipeline, records a Chrome trace of it, and prints a JSON report. It sends every gesture over the
debugging protocol, so it never holds the real keyboard or mouse. The scenarios are the keys of
`SCENARIOS` in `apps/desktop/src/development/profile/scenarios.ts`.

## Profile on request

1. Pick the **target**. The dev instance (`bun run dev`) is the default: it is slower than a
   release, but every bottleneck it shows is real, and it reloads while you fix one. Use
   `--packaged` to judge what a user sees, after `bun run --cwd apps/desktop package`. The packaged
   target seeds its own long Session, or copies a real transcript with `--transcript <file>`.
2. For the dev target, make sure that the dev instance runs. If `bun run desktop:status` fails,
   start `bun run dev` from the worktree root as a background command, and wait until the status
   command prints a record. That record must have a `debugPort`. A record without one comes from
   an instance started before #2228: stop it with `bun run desktop:stop` and start it again.
3. Open the screen the scenario needs. For `feed-scroll`, that is a Session with a long history.
   Pass `--session <id>` to open it, and take the id from a Roster row's `data-session-id`. The
   command refuses a Feed that scrolls less than 4000 px.
4. Run the scenario with its defaults (3 runs). Keep the app window uncovered for the whole run.
   Chromium throttles a covered window, and the command refuses a run it throttled.
5. Read the report (below) and name the bottleneck. You are done when you can name the function
   or the missing work that costs the frames, and cite the report line or trace event for it.
6. After a fix, run the same command on the same target and Session, and compare the `runs`
   figures. A fix is proved only when `best` improves beyond the spread between the runs.

## The report

- `runs` holds one line per run. Compare runs and never trust one alone: `best` is the run with
  the fewest dropped frames, because another process only ever makes a run slower.
- `frames.dropped` counts missed vsyncs against the display's own period. Frame times over one
  period are **jank**.
- `blank.exposedFrames` and `worstExposedPx` measure the **white flash**: the compositor scrolled
  past the rows mounted at the previous frame, so the reader saw empty space. It can appear with
  no dropped frames at all. Then the overscan is too short for the speed, and the main thread is
  not at fault.
- `blank.paintedFrames` counts frames the main thread itself painted with part of the viewport
  empty. A non-zero value is a layout bug, not a performance cost.
- `longFrames.worst` and `longFrames.scripts` name the scripts behind each long animation frame,
  with the layout time each one forced.
- `trace.byEvent` is main-thread self time by trace event. `trace.forcedLayouts` counts layouts
  that script forced mid-frame. `trace.hotFunctions` is where the CPU sampler caught JavaScript.
- `trace.file` opens in DevTools (Performance, then Load profile) or at ui.perfetto.dev. Add
  `--screenshots` for a filmstrip, which makes the file several times larger.

## Dev-only noise

The dev target pays for React's development build, and the report shows it. Discount these on
the dev target, and confirm a finding on `--packaged` before you call it a user-facing cost:

- `measure` and `UserTiming::Measure`: React's performance tracks.
- `jsxDEV`, and the part of `performWorkUntilDeadline` that the packaged run does not show.
- Script sources under `/node_modules/.vite/deps/`, which are unminified dev bundles.

Dev and packaged numbers differ by an order of magnitude on the same Session. Compare a before
and an after only on one target.

## Speed

`--speed` is the fling speed in px/s (default 6000), and `--distance` is the travel of each pass
(default 20000). A hard trackpad fling reaches about 20000 px/s. If the reader reports a flash
that the defaults do not show, raise `--speed` before you conclude that nothing is wrong.

## Add a scenario

A scenario is one file under `apps/desktop/src/development/profile/` that implements `Scenario`
from `scenario.ts`, plus one entry in `SCENARIOS`. It opens its screen, prepares a repeatable
start, and drives the gesture over the page's CDP session. `feed-scroll.ts` is the model.
