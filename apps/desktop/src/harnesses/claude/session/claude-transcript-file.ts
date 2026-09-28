import { readdir, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'

const rawTranscriptLineSchema = z
  .object({
    type: z.string(),
    uuid: z.string().min(1),
    parentUuid: z.string().nullable().optional(),
    logicalParentUuid: z.string().nullable().optional(),
    isSidechain: z.boolean().optional(),
  })
  .passthrough()

type RawTranscriptLine = z.infer<typeof rawTranscriptLineSchema>

function projectsRoot(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')
}

// The CLI's own encoding: every character that is not a letter or digit becomes `-`.
function encodedProjectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

async function fileExists(candidate: string): Promise<boolean> {
  return stat(candidate)
    .then((info) => info.isFile())
    .catch(() => false)
}

async function locateTranscriptFile(nativeId: string, cwd: string | null): Promise<string | null> {
  const root = projectsRoot()
  const filename = `${nativeId}.jsonl`
  if (cwd !== null) {
    const candidate = path.join(root, encodedProjectDirName(cwd), filename)
    if (await fileExists(candidate)) return candidate
  }
  const projectDirs = await readdir(root, { withFileTypes: true }).catch(() => [])
  for (const entry of projectDirs) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(root, entry.name, filename)
    if (await fileExists(candidate)) return candidate
  }
  return null
}

export function parseTranscriptLines(text: string): RawTranscriptLine[] {
  return text
    .split('\n')
    .flatMap((line) => {
      if (line.trim() === '') return []
      try {
        return [JSON.parse(line)]
      } catch {
        // Tolerates a partial trailing line from a writer still appending to the file.
        return []
      }
    })
    .flatMap((candidate) => {
      const parsed = rawTranscriptLineSchema.safeParse(candidate)
      return parsed.success ? [parsed.data] : []
    })
}

// Walks the conversation backward from the last entry, following `parentUuid`. A compaction
// boundary carries `parentUuid: null` and links to the chain it replaced through
// `logicalParentUuid` instead, so falling back to that field crosses the boundary rather than
// stopping there.
export function chainFromLines(lines: readonly RawTranscriptLine[]): RawTranscriptLine[] {
  const relevant = lines.filter(
    (entry) =>
      (entry.type === 'user' || entry.type === 'assistant' || entry.type === 'system') &&
      entry.isSidechain !== true,
  )
  const byUuid = new Map(relevant.map((entry) => [entry.uuid, entry]))
  const tail = relevant.at(-1)
  if (tail === undefined) return []
  const chain: RawTranscriptLine[] = []
  const seen = new Set<string>()
  let current: RawTranscriptLine | undefined = tail
  while (current !== undefined && !seen.has(current.uuid)) {
    seen.add(current.uuid)
    chain.push(current)
    const parentUuid: string | null = current.parentUuid ?? current.logicalParentUuid ?? null
    current = parentUuid === null ? undefined : byUuid.get(parentUuid)
  }
  return chain.reverse()
}

export async function readClaudeTranscriptChain(
  nativeId: string,
  cwd: string | null,
): Promise<unknown[]> {
  const filePath = await locateTranscriptFile(nativeId, cwd)
  if (filePath === null) return []
  const text = await readFile(filePath, 'utf8').catch(() => null)
  if (text === null) return []
  return chainFromLines(parseTranscriptLines(text))
}
