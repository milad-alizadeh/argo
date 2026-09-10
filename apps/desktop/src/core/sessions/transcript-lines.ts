import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export const ROSTER_FILE_LIMIT = 200

export async function readTranscriptLines(filePath: string): Promise<string[]> {
  const lines: string[] = []
  const reader = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of reader) lines.push(line)
  return lines
}
