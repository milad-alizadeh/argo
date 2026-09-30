// A write touches one top-level line of the person's own `config.toml`, so their key order and
// hand-written comments survive, which a TOML parse and reserialize would lose.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { autoCompactLimitSchema, DEFAULT_AUTO_COMPACT_LIMIT } from '../auto-compact-limit'

const KEY = 'model_auto_compact_token_limit'

const KEY_LINE = new RegExp(`^\\s*${KEY}\\s*=\\s*(\\d+)\\s*$`)
const TABLE_HEADER = /^\s*\[/

export function codexConfigPath(codexHome: string): string {
  return path.join(codexHome, 'config.toml')
}

// Top-level keys sit before the first `[table]` header; everything from there on is left untouched.
function topLevelEnd(lines: string[]): number {
  const index = lines.findIndex((line) => TABLE_HEADER.test(line))
  return index === -1 ? lines.length : index
}

function parsedLimit(value: number): number {
  const parsed = autoCompactLimitSchema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new Error(`${KEY} = ${value} in config.toml is outside the range Argo can show.`)
}

export async function readAutoCompactLimit(codexHome: string): Promise<number> {
  const text = await readFile(codexConfigPath(codexHome), 'utf8').catch(() => null)
  if (text === null) return DEFAULT_AUTO_COMPACT_LIMIT
  const lines = text.split('\n')
  for (const line of lines.slice(0, topLevelEnd(lines))) {
    const match = KEY_LINE.exec(line)
    if (match) return parsedLimit(Number(match[1]))
  }
  return DEFAULT_AUTO_COMPACT_LIMIT
}

export async function writeAutoCompactLimit(codexHome: string, chosen: number): Promise<number> {
  const limit = autoCompactLimitSchema.parse(chosen)
  const filePath = codexConfigPath(codexHome)
  const text = await readFile(filePath, 'utf8').catch(() => '')
  const lines = text === '' ? [] : text.split('\n')
  const end = topLevelEnd(lines)
  const existingIndex = lines.slice(0, end).findIndex((line) => KEY_LINE.test(line))
  const newLine = `${KEY} = ${limit}`
  if (existingIndex === -1) {
    // Above the blank lines that separate the top-level keys from the first table header.
    let insertAt = end
    while (insertAt > 0 && (lines[insertAt - 1] ?? '').trim() === '') insertAt -= 1
    lines.splice(insertAt, 0, newLine)
  } else {
    lines[existingIndex] = newLine
  }
  await mkdir(path.dirname(filePath), { recursive: true })
  const content = lines.join('\n')
  await writeFile(filePath, content.endsWith('\n') ? content : `${content}\n`)
  return limit
}
