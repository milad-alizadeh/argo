// A surgical edit of `~/.codex/config.toml`: the file is the Codex CLI's own, shared with
// `codex` itself and never checked into this repo, so a write here must touch only the one key
// (docs/adr/0024-session-drive-port-two-adapters.md — a CLI owns its own adapter and config
// shape). A full TOML parse-and-reserialize would reorder keys and drop comments the person
// wrote by hand; reading and writing one line among the top-level keys does not.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_AUTO_COMPACT_LIMIT } from '@/domains/sessions/contract/codex-compaction'

const KEY = 'model_auto_compact_token_limit'

const KEY_LINE = new RegExp(`^\\s*${KEY}\\s*=\\s*(\\d+)\\s*$`)
const TABLE_HEADER = /^\s*\[/

export function codexConfigPath(home: string): string {
  return path.join(home, '.codex', 'config.toml')
}

// Top-level keys (`model = "..."`, this one) sit before the first `[table]` header; everything
// from there on, `[projects."..."]` included, is left untouched.
function topLevelEnd(lines: string[]): number {
  const index = lines.findIndex((line) => TABLE_HEADER.test(line))
  return index === -1 ? lines.length : index
}

export async function readAutoCompactLimit(home: string): Promise<number> {
  const text = await readFile(codexConfigPath(home), 'utf8').catch(() => null)
  if (text === null) return DEFAULT_AUTO_COMPACT_LIMIT
  const lines = text.split('\n')
  for (const line of lines.slice(0, topLevelEnd(lines))) {
    const match = KEY_LINE.exec(line)
    if (match) return Number(match[1])
  }
  return DEFAULT_AUTO_COMPACT_LIMIT
}

export async function writeAutoCompactLimit(home: string, limit: number): Promise<void> {
  const filePath = codexConfigPath(home)
  const text = await readFile(filePath, 'utf8').catch(() => '')
  const lines = text === '' ? [] : text.split('\n')
  const end = topLevelEnd(lines)
  const existingIndex = lines.slice(0, end).findIndex((line) => KEY_LINE.test(line))
  const newLine = `${KEY} = ${limit}`
  if (existingIndex === -1) {
    // Grouped with the other top-level keys, above any blank line that separates them from the
    // first table header, rather than glued onto the header itself.
    let insertAt = end
    while (insertAt > 0 && (lines[insertAt - 1] ?? '').trim() === '') insertAt -= 1
    lines.splice(insertAt, 0, newLine)
  } else {
    lines[existingIndex] = newLine
  }
  await mkdir(path.dirname(filePath), { recursive: true })
  const content = lines.join('\n')
  await writeFile(filePath, content.endsWith('\n') ? content : `${content}\n`)
}
