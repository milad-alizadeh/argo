// Measures what opening one Session costs: the time `readSessionFiles` takes to answer for a
// Session at a given depth in the transcript tree, newest file first (#2507). Run it against a
// real Claude transcript root, cold (paging the tree) and warm (once the Session index has
// backfilled it), to show what the indexed open path buys.
import { mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { openSessionIndex } from '@/domains/sessions/main/index/session-index/open-index'
import {
  backfillTick,
  discoverSessions,
  readSessionFiles,
  transcriptPaths,
} from '@/harnesses/claude/sessions/discover'

const root = process.argv[2] ?? path.join(os.homedir(), '.claude', 'projects')
const depths = (process.argv[3] ?? '0,10,200,1000').split(',').map(Number)

async function transcriptsNewestFirst() {
  const identities = await Promise.all(
    (await transcriptPaths(root)).map(async (transcript) => {
      const written = await stat(transcript.path).catch(() => null)
      return written === null ? null : { ...transcript, writtenAt: written.mtimeMs }
    }),
  )
  return identities
    .filter((transcript): transcript is NonNullable<typeof transcript> => transcript !== null)
    .sort((left, right) => right.writtenAt - left.writtenAt)
}

type Transcript = Awaited<ReturnType<typeof transcriptsNewestFirst>>[number]

async function reportOpenCosts(
  transcripts: Transcript[],
  index?: Awaited<ReturnType<typeof openSessionIndex>>,
) {
  for (const depth of depths) {
    const transcript = transcripts[depth]
    if (transcript === undefined) continue
    const started = performance.now()
    const chain = await readSessionFiles(root, transcript.sessionId, index)
    const took = Math.round(performance.now() - started)
    const files = chain === null ? 'not found' : `${chain.files.length} files`
    console.log(`depth ${String(depth).padStart(4)}  ${String(took).padStart(7)} ms  ${files}`)
  }
}

const transcripts = await transcriptsNewestFirst()
console.log(`${transcripts.length} transcripts under ${root}`)

console.log('\ncold (no index, pages the tree):')
await reportOpenCosts(transcripts)

const indexFolder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-open-cost-'))
try {
  const index = openSessionIndex(path.join(indexFolder, 'sessions.db'))
  try {
    console.log('\nbackfilling the Session index (one-time cost)...')
    const backfillStarted = performance.now()
    await discoverSessions(root, { index })
    let progress = await backfillTick(root, index)
    while (!progress.complete) progress = await backfillTick(root, index)
    console.log(`backfill took ${Math.round(performance.now() - backfillStarted)} ms`)

    console.log('\nwarm (indexed):')
    await reportOpenCosts(transcripts, index)
  } finally {
    await index.close()
  }
} finally {
  await rm(indexFolder, { recursive: true, force: true })
}
