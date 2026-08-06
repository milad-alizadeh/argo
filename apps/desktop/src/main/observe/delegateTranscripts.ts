import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import type { Turn } from '../../shared'
import { parseTranscript } from './claudeTranscript'
import type { ImageReader } from './mediaResult'
import { parseLine, stringField } from './untrusted'

// A delegate's own turns, which its parent's transcript does not carry. Claude writes each
// subagent to `<transcript-dir>/<sessionId>/subagents/agent-<id>.jsonl`, with a `.meta.json`
// beside it naming the `toolUseId` of the call that spawned it — which is the id the parent's
// Subagent seed already carries, so the two sides join on a fact both files state rather than on
// filename order.
//
// Without this read a delegate is a rail row with an empty feed: its whole interior lives in these
// files, and the parent's own records mention it only as one `Task` call.

/** Where a transcript's delegate files sit, derived from the transcript's own path. */
export const delegateDirectory = (transcriptPath: string): string =>
  join(dirname(transcriptPath), basename(transcriptPath, '.jsonl'), 'subagents')

const META_SUFFIX = '.meta.json'

/**
 * The SESSION transcript a changed file belongs to — itself for `<project>/<id>.jsonl`, and the
 * parent for anything nested under `<project>/<id>/` (a delegate's transcript, a spilled tool
 * result). `null` for a path outside the root.
 *
 * The watch is recursive, so it names those nested files too. Read as sessions they became rows for
 * agents that are not sessions; read as what they are, a delegate appending is exactly the moment
 * its parent's reading changed.
 */
export function owningTranscript(root: string, path: string): string | null {
  const segments = relative(root, path).split(sep)
  if (segments.length < 2 || segments[0] === '..') return null
  const [project, owner] = segments
  return segments.length === 2 ? path : join(root, project, `${owner}.jsonl`)
}

/** The delegating call this file is the interior of, or `null` when the sidecar does not say —
 * an unjoinable transcript is left unread rather than attached to a guessed call. */
async function toolUseIdOf(metaPath: string): Promise<string | null> {
  try {
    return stringField(parseLine(await readFile(metaPath, 'utf8')), 'toolUseId')
  } catch {
    return null
  }
}

async function turnsOf(path: string, readImage: ImageReader): Promise<Turn[]> {
  try {
    const contents = await readFile(path, 'utf8')
    // `sidechain: true`: this file IS the delegate's, so its sidechain records are its content
    // rather than another agent's work spliced into a parent.
    const parsed = parseTranscript(basename(path, '.jsonl'), contents.split('\n'), {
      readImage,
      sidechain: true,
    })
    return parsed.tree.turns
  } catch {
    return []
  }
}

/**
 * Every delegate transcript beside one parent transcript, keyed by the id of the call that spawned
 * it. An absent directory (a session that delegated nothing, or a CLI that writes none) is an
 * empty result, never a throw.
 */
export async function readDelegateTurns(
  transcriptPath: string,
  readImage: ImageReader,
): Promise<Record<string, Turn[]>> {
  const directory = delegateDirectory(transcriptPath)
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    return {}
  }
  const delegates: Record<string, Turn[]> = {}
  for (const entry of entries) {
    if (!entry.endsWith(META_SUFFIX)) continue
    const toolUseId = await toolUseIdOf(join(directory, entry))
    if (toolUseId === null) continue
    const transcript = join(directory, `${entry.slice(0, -META_SUFFIX.length)}.jsonl`)
    delegates[toolUseId] = await turnsOf(transcript, readImage)
  }
  return delegates
}
