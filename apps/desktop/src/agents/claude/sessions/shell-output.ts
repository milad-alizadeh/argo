// What one background Shell has written (#1582). The CLI streams a background command's output
// to a file of its own and names that file in the receipt it answers the call with, so reading
// the command means reading that file. The renderer names the CALL; the path is resolved here,
// from the Session's own transcript, and never accepted from outside the main process.
import { open, stat } from 'node:fs/promises'
import type { SessionChain } from '@/domains/sessions/contract/model/chains'
import { readShellCommands } from '@/domains/sessions/contract/observation/signals'
import { chainBackgroundTasks, chainMessages } from '@/domains/sessions/main/projection/roster'

// How much of the tail one read carries. A watcher left running for an hour writes more than a
// pane can draw, and the end is the part a reader is watching.
const TAIL_BYTES = 64 * 1024

async function readTail(path: string): Promise<string> {
  const size = (await stat(path)).size
  const from = Math.max(0, size - TAIL_BYTES)
  const file = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(size - from)
    await file.read(buffer, 0, buffer.length, from)
    const text = buffer.toString('utf8')
    // A cut at a byte offset can land inside a character or a line; the first partial line goes
    // rather than being drawn as mojibake.
    return from === 0 ? text : text.slice(text.indexOf('\n') + 1)
  } finally {
    await file.close()
  }
}

export async function readShellOutput(
  chain: SessionChain | null,
  shellId: string,
): Promise<string | null> {
  if (chain === null) return null
  const command = readShellCommands(chainMessages(chain), chainBackgroundTasks(chain)).find(
    (candidate) => candidate.id === shellId,
  )
  if (command?.outputPath == null) return null
  // The file is the CLI's, not Argo's: a command whose output was cleaned up reads as no output
  // rather than as a failure of the pane around it.
  return readTail(command.outputPath).catch(() => null)
}
