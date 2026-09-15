# Why an external Session's Feed spins forever and the window stops answering

Finding for #2111. It answers the question #2102 asks before its fix can start: is the freeze (a)
a main-thread block, or (b) an overlay left mounted over the window?

**It is (a), and it is in the main process, not the renderer.** There is no overlay. The Feed read
never answers because the main process reads the transcript in a loop that only ends when the file
stops changing, and a transcript a real terminal is still writing never stops changing. The window
looks frozen because that loop parses the whole transcript again and again, so every other message
the main process must answer queues behind it.

## The code path

`stableChain` in `apps/desktop/src/core/sessions/feed-cache.ts`:

```ts
let before = await chainStamps(paths)
for (;;) {
  const chain = await source.readSessionFiles(sessionId)
  const stamps = await chainStamps(chain.files.map((file) => file.path))
  if (before === stamps) return { chain, stamps }
  before = stamps
}
```

`chainStamps` is the file's `mtime` and `size`, and the containing folder's. The loop's only exit is
two consecutive reads that see neither change. Each pass is a full read and parse of every file in
the chain, through `readSessionFiles`
(`apps/desktop/src/core/sessions/discover-transcript-sessions.ts`) and `readTranscriptFile`
(`apps/desktop/src/core/sessions/transcript.ts`). Nothing bounds the number of passes and nothing
cancels them.

An `external` Session is a Session a real terminal owns, and that terminal appends to the transcript
for as long as its Turn runs. While a Turn runs, the file changes faster than one pass takes, so the
comparison never holds:

- `readSessionFeed` (`apps/desktop/src/core/sessions/reader.ts`) never returns, so
  `feedContent` keeps `settled === null` and draws `RunningFeed`'s spinner
  (`apps/desktop/src/renderer/modules/sessions/feed/feed-content.tsx`). The spinner is a CSS
  animation, so it keeps turning while nothing progresses.
- The loop is the main process's own work. Every menu command, window action and other IPC waits
  behind whichever parse is running.
- The folder's stamp is in the key too, so another Session writing in the same project folder holds
  the loop open as well.

The transcript reading is shared code rather than an adapter's, so the fix sits in
`core/sessions/`, not under `agents/<cli>/` (ADR-0024). Both CLI adapters reach it through the same
`readSessionFiles`.

## Evidence

`apps/desktop/src/core/sessions/fake-driver/stalled-feed-repro.ts` runs the shipped reader against a
fixture transcript, with a second process appending to it, and drives it the way the renderer does:
a Feed read and a Roster poll every 500 ms, one in flight at a time, plus a ping that stands in for
the cheapest thing a click can ask the main process for. Each run is a cold start, with empty caches
— the state the app is in at launch.

```
bun src/core/sessions/fake-driver/stalled-feed-repro.ts            # still being written
APPEND=0 bun src/core/sessions/fake-driver/stalled-feed-repro.ts   # the same file, unchanging
```

Watched for 20 s each, on an M-series Mac:

| transcript | still being written | Feed settles | worst ping | peak memory |
| --- | --- | --- | --- | --- |
| 20k lines, 8.7 MB | yes | never | 22 ms | 576 MB |
| 20k lines, 8.7 MB | no | 125 ms | 0 ms | — |
| 100k lines, 43 MB | yes | never | 127 ms | 1902 MB |
| 100k lines, 43 MB | no | 560 ms | 6 ms | 1096 MB |
| 200k lines, 87 MB | yes | never | 285 ms | 3858 MB |
| 200k lines, 87 MB | no | 1099 ms | 10 ms | 1755 MB |

Two readings, both of them the mechanism:

- **The Feed never settles at any size**, as long as the file is being written. Not slow: never. The
  Roster poll beside it keeps completing throughout (21 to 37 polls per run), which is why the
  sidebar still looks populated behind the spinner.
- **The cost of one pass sets how frozen the window feels**, and it grows with the transcript. At
  8.7 MB the main process still answers in 22 ms. At 87 MB the worst ping is 285 ms and the process
  holds nearly 4 GB after 20 s, because each pass allocates the whole parsed transcript again. A
  machine paging at that size answers nothing on time, which is the reported freeze.

## Not an overlay

`apps/desktop/src/renderer/modules/sessions/screens/session-feed-stall.stories.tsx` holds the Feed
read open forever and reads the window while the spinner shows. It passes today:

- `document.elementFromPoint` over a Roster row answers with the row, so nothing covers it.
- A click on that row is delivered to it and leaves the focus there, which a cover would prevent.
- The spinner is still there a second later, since nothing bounds it.

The loading state is a `<section>` inside the Feed pane. No portal, no `inert` and no
`pointer-events` rule is mounted over the window in this path. The renderer is not blocked either:
this story's React tree keeps rendering and answering input with the read outstanding.

## Reproducible from launch, and self-clearing

Not a one-off. Every run of the repro is a fresh process, and every run stalls, so relaunching
against a Session whose terminal is still working reproduces it. Force-quitting and reopening
changes nothing while that terminal keeps writing.

It clears itself when the writing stops. With the writer killed 6 s into a run, the Feed settled
342 ms later:

```
APPEND_STOP_MS=6000 bun src/core/sessions/fake-driver/stalled-feed-repro.ts
{"ok":true,"feedSettled":true,"feedSettledMs":6342,...}
```

So the stall lasts exactly as long as the terminal's Turn. A long Turn in another window is a long
freeze, and the app recovering on its own is expected rather than evidence against this cause.

## What this means for the fix (#2102)

- A timeout in `feedContent` bounds the spinner, which is worth having, but it does not touch the
  loop. The loop keeps running and the main process stays as busy after the stalled state appears
  as before it.
- The loop wants a bound of its own: a pass limit, or serving the read that a pass already has
  rather than insisting on a quiet file. A Session being written is the normal case for `external`,
  not an edge.
- Cancel-on-navigate has to reach the main process. Dropping the renderer's promise leaves the loop
  running.
- Re-parsing the whole chain per pass is what turns the loop from busy into freezing. Reading the
  appended part, or parsing off the main process, bounds the cost whether or not the loop stays.
