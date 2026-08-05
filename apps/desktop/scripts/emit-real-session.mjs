#!/usr/bin/env bun
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parseTranscript } from '../src/main/observe/claudeTranscript.ts'

// Emits `realSession.json` — the fixture the Sessions stories render — from a REAL Claude Code
// transcript on this machine, through the app's OWN parser.
//
// Through the parser, not around it, and that is the point of the script existing at all: the
// fixture is then a recording of what observation actually yields, so a parser bug shows up in a
// story instead of being hand-edited out of the sample. It also means the fixture has to be
// RE-EMITTED when the parser changes — a stale one silently pins the old reading, which is exactly
// what happened to the turn segmentation this script was first run to fix.
//
//   bun scripts/emit-real-session.mjs <path-to-transcript.jsonl>
//
// macOS-only: it shells out to `sips` to downscale the screenshots. That is a deliberate limit for
// a one-off developer tool rather than a gap — nothing in the app depends on this running.

const SOURCE = process.argv[2]
const OUT = join(
  import.meta.dirname,
  '../src/renderer/src/rooms/sessions/__fixtures__/realSession.json',
)

// Screenshots at native resolution are ~400KB of base64 each and there are eight of them. The
// fixture is committed and read on every story render, so they are downscaled and re-encoded to a
// size that still reads as the picture it was — the stories are judged on layout and legibility,
// neither of which needs the original pixels.
//
// The re-encode changes the media TYPE, so the emitted result declares JPEG rather than carrying
// the transcript's `image/png` over bytes that are no longer PNG. A fixture may be smaller than
// what it was made from; it may not lie about what it holds.
const THUMB_WIDTH = 700
const THUMB_TYPE = 'image/jpeg'

// Tool output is the bulkiest thing in a real transcript and the least interesting past its first
// screen: a `bun test` run prints thousands of lines that every surface truncates anyway.
const OUTPUT_CAP = 4000

const scratch = mkdtempSync(join(tmpdir(), 'argo-fixture-'))

let shrunk = 0

/** One image file, downscaled and re-encoded, base64 — or `null` where it cannot be read, which is
 * the same answer the app's own reader gives and is what keeps the absent case in the fixture
 * honest rather than smoothed away. */
function scaleFile(path) {
  if (!existsSync(path)) return null
  try {
    const out = join(scratch, `${basename(path)}-${shrunk++}.jpg`)
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', String(THUMB_WIDTH)]
    execFileSync('sips', [...args, path, '--out', out], { stdio: 'ignore' })
    return readFileSync(out).toString('base64')
  } catch {
    return null
  }
}

/** The same treatment for bytes the RECORD carried. Most images in a real transcript arrive this
 * way — the parser prefers the agent's own bytes over a re-read of the path, which is the whole
 * point of the media tier — so downscaling only the disk fallback shrinks almost nothing. */
function scaleBytes(base64, mediaType) {
  const source = join(scratch, `embedded-${shrunk}.${mediaType.split('/').at(-1)}`)
  try {
    writeFileSync(source, Buffer.from(base64, 'base64'))
    return scaleFile(source)
  } catch {
    return null
  }
}

const parseFile = (path, sidechain = false) =>
  parseTranscript(basename(path, '.jsonl'), readFileSync(path, 'utf8').split('\n'), {
    readImage: scaleFile,
    sidechain,
  })

function capResult(result) {
  if (result === null) return null
  if (result.kind === 'output') return { ...result, text: result.text.slice(0, OUTPUT_CAP) }
  if (result.kind !== 'media' || result.bytes === null) return result
  const bytes = scaleBytes(result.bytes, result.mediaType)
  // A re-encode that fails leaves the row with no bytes rather than with the full-size original:
  // the fixture is committed, and one unshrunk screenshot is a third of a megabyte in git.
  return bytes === null ? { ...result, bytes: null } : { ...result, mediaType: THUMB_TYPE, bytes }
}

const capCall = (call) => ({ ...call, result: capResult(call.result) })
const capTurn = (turn) => ({ ...turn, toolCalls: turn.toolCalls.map(capCall) })

const root = parseFile(SOURCE)

// A subagent's own turns live in its sidechain file, which carries no back-reference to the
// `tool_use` that spawned it — so they are matched by ORDER, oldest first, against the delegating
// calls in the same order. A heuristic, and one only this fixture script leans on: the app itself
// renders subagents from the delegating call alone and never claims their interior turns.
const sidechainDir = SOURCE.replace(/\.jsonl$/, '/subagents')
const sidechains = existsSync(sidechainDir)
  ? readdirSync(sidechainDir)
      .filter((name) => name.endsWith('.jsonl'))
      // `true`: these files ARE the delegates' own, and every record in them is a sidechain record.
      // Without it the parser's parent-side guard drops all of them and each subagent lands with an
      // empty feed — which is exactly what shipped in the fixture before this argument was passed.
      .map((name) => parseFile(join(sidechainDir, name), true))
      .sort((left, right) => (left.firstTimestampMs ?? 0) - (right.firstTimestampMs ?? 0))
  : []

const seeds = root.tree.subagents
const agents = [
  {
    id: 'root',
    parentId: null,
    turns: root.tree.turns.map(capTurn),
    compactions: root.tree.compactions,
    startedAtMs: root.tree.turns[0]?.startedAtMs ?? null,
    endedAtMs: root.tree.turns.at(-1)?.endedAtMs ?? null,
    usage: null,
  },
  ...seeds.map((seed, index) => ({
    ...seed,
    parentId: 'root',
    turns: (sidechains[index]?.tree.turns ?? []).map(capTurn),
    compactions: [],
  })),
]

const fixture = {
  session: {
    id: 'real-318',
    title: root.aiTitle ?? root.firstPrompt ?? 'Untitled session',
    model: root.model,
    branch: root.gitBranch,
    // The session's own working directory. Every path in the feed is SHOWN relative to it, so a
    // fixture without one renders the absolute paths the surface exists to stop repeating — which
    // is exactly the state the real feed is never in.
    cwd: root.cwd,
    lastActivityAt: root.lastTimestampMs,
  },
  agents,
}

// Two-space indent and a trailing newline: the output is a committed file like any other, and the
// repo's formatter gates it. An emitter whose product fails `bun run quality` is an emitter you
// have to remember to reformat after.
writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`)

const images = agents
  .flatMap((agent) => agent.turns)
  .flatMap((turn) => turn.toolCalls)
  .filter((call) => call.result?.kind === 'media')
console.log(
  `${OUT}\n` +
    `  turns    ${agents[0].turns.length} root, ${agents.length - 1} subagents\n` +
    `  images   ${images.filter((call) => call.result.bytes !== null).length}/${images.length} with bytes\n` +
    `  size     ${(readFileSync(OUT).length / 1024 / 1024).toFixed(2)} MB`,
)
