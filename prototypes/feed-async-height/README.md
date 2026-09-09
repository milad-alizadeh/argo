# feed-async-height — how much does an async row cost?

Throwaway measurement rig for
[#1793](https://github.com/milad-alizadeh/argo/issues/1793). The findings are in
[`docs/research/2026-09-09-async-feed-row-height.md`](../../docs/research/2026-09-09-async-feed-row-height.md);
this file is how to re-run it.

The ticket's own framing is the reason this exists: *"Most of this is a measurement, not a debate.
Build the cheapest thing that renders the diagrams from a real transcript in a browser and time
them."* So nothing here is a Feed, a row or a list. It renders diagrams and reads heights.

## Run it

```sh
bun install
bun mine-corpus.ts          # writes corpus.json — gitignored, see below
bun build harness.ts --outfile bundle.js --target browser
bun serve.ts                # http://localhost:8793/
```

Open the page in Chrome and leave it alone. The run posts itself to `results.json` when it
finishes, and the page logs its progress as it goes. **The main thread is blocked for most of the
run** — that is the thing being measured, not a fault in the rig — so the tab is unresponsive and
devtools will time out on it.

## What each file is

| File | What it does |
| --- | --- |
| `mine-corpus.ts` | Pulls every fenced block out of the local Claude Code transcripts into `corpus.json`. |
| `harness.ts` | The sweep: cold and warm mermaid renders, interleaved repeats, then the async arms. |
| `predict.ts` | The source-only height predictor, and the score against what was drawn. |
| `synthetic.ts` | Chain and fan flowcharts at seven sizes, for the scaling curve. |
| `async-arms.ts` | Remote image, late web font, highlighter, and the failure case. |
| `measure.ts` | The one column width, and the measurement box every arm shares. |
| `png.ts` | Generates the image arm's fixture, so it cannot be a corrupt paste. |
| `serve.ts` | Static host that can delay a response, and takes the results POST. |
| `report.ts` | Renders `results.json` into the tables the research doc quotes. |
| `results.json` | The committed run. Metrics only. |

## Why `corpus.json` is not committed

It is mined from the user's own transcripts and this repo is public, so it stays on the machine —
the same rule `return-path-eval` follows. What is committed is `results.json`, which carries
per-diagram metrics keyed by a content hash and not one line of source. The rig is therefore
reproducible in shape by anyone with their own transcripts, and reproducible exactly by nobody,
which is the correct trade for a public repo.

## What the numbers are not

- **Not Electron.** This is Chrome on macOS. Electron is Chromium, so the layout engine is the
  same one, but the version and the flags are not pinned to whatever Argo will ship.
- **Not a network measurement.** The image and font arms are served from localhost with a stated
  delay, so they measure the browser's handling of a late resource, not anyone's CDN.
- **Not a bundle measurement.** Everything is bundled eagerly into one file, so mermaid's
  per-diagram-type dynamic import never touches the network. The "cold" number is mermaid
  initialising a diagram type, not fetching it.
