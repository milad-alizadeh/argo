import { existsSync, readFileSync } from 'node:fs'

// The uuid the next record of a resumed Session chains to: the newest earlier main-chain record,
// as real Claude links a continued Session. Null when the transcript has no such record.
export function newestChainUuid(transcript: string): string | null {
  if (!existsSync(transcript)) return null
  let newest: string | null = null
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    try {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== 'object' || parsed === null) continue
      const { uuid, isSidechain } = parsed as { uuid?: unknown; isSidechain?: unknown }
      if (typeof uuid === 'string' && isSidechain !== true) newest = uuid
    } catch {
      // A blank or half-written line carries no record.
    }
  }
  return newest
}
