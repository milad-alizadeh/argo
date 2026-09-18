// The Subagent transcripts Claude writes beside a Session's own (#1582). A Session's file
// `<project>/<sessionId>.jsonl` has a folder `<project>/<sessionId>/subagents/` next to it
// holding one `agent-<id>.jsonl` per Subagent, each with an `agent-<id>.meta.json` naming the
// `Task` call that spawned it. That meta file is the only join between a Subagent's transcript
// and the delegation the Roster row already draws (CONTEXT.md L3 · Subagent).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SessionChain } from '@/core/sessions/chains'
import { type TranscriptFile, transcriptFileFrom } from '@/core/sessions/transcript'
import { createTranscriptRecordReader } from '@/core/sessions/transcript-lines'
import { isRecord } from '@/shared/validation'
import { parseTranscriptLine } from './records'

const META = '.meta.json'
const { readRecords } = createTranscriptRecordReader(parseTranscriptLine)

// The call id one Subagent's meta file names, or null where the file is unreadable or names none.
async function callOf(metaPath: string): Promise<string | null> {
  const parsed: unknown = await readFile(metaPath, 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => null)
  return isRecord(parsed) && typeof parsed.toolUseId === 'string' ? parsed.toolUseId : null
}

// Every Subagent transcript this chain has, keyed by the call that spawned it. A chain that
// resumed carries several links, and each link keeps its own Subagents.
async function subagentPaths(chain: SessionChain): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (const file of chain.files) {
    const folder = path.join(path.dirname(file.path), file.sessionId, 'subagents')
    const names = await readdir(folder).catch(() => [])
    for (const name of names) {
      if (!name.endsWith(META)) continue
      const callId = await callOf(path.join(folder, name))
      if (callId === null) continue
      found.set(callId, path.join(folder, `${name.slice(0, -META.length)}.jsonl`))
    }
  }
  return found
}

// Every record in a Subagent's own file is a sidechain of the parent, which is what makes the
// shared projection drop it. Inside its OWN Feed it is the main thread, so the flag is cleared
// here rather than teaching the projection a second meaning for it.
function asOwnThread(file: TranscriptFile): TranscriptFile {
  return {
    ...file,
    records: file.records.map((record) =>
      record.kind === 'message' ? { ...record, sidechain: false } : record,
    ),
  }
}

async function readSubagentFile(filePath: string): Promise<TranscriptFile | null> {
  const records = await readRecords(filePath).catch(() => null)
  if (records === null) return null
  return asOwnThread(transcriptFileFrom(filePath, { fileName: path.basename(filePath), records }))
}

// One Subagent's transcript as a chain of its own, so the Feed the reader already projects for a
// Session projects this the same way. Null where the Session records no Subagent for that call.
export async function readDelegationChain(
  chain: SessionChain | null,
  delegationId: string,
): Promise<SessionChain | null> {
  if (chain === null) return null
  const filePath = (await subagentPaths(chain)).get(delegationId)
  if (filePath === undefined) return null
  const file = await readSubagentFile(filePath)
  if (file === null) return null
  return { id: delegationId, retiredIds: [], files: [file], originUnread: false }
}

// What each Subagent spent, summed the way the Roster sums a Session's own spend: the tokens the
// work consumed, cache reads excluded. A Subagent whose transcript reports no usage reads null.
export async function readDelegationTokens(
  chain: SessionChain | null,
): Promise<{ id: string; tokens: number | null }[]> {
  if (chain === null) return []
  const paths = [...(await subagentPaths(chain))]
  return Promise.all(
    paths.map(async ([id, filePath]) => {
      const file = await readSubagentFile(filePath)
      const reported = (file?.records ?? []).flatMap((record) =>
        record.kind === 'message' && record.usage !== null ? [record.usage] : [],
      )
      return {
        id,
        tokens:
          reported.length === 0
            ? null
            : reported.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0),
      }
    }),
  )
}
