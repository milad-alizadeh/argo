import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { historyRecord, jsonObject } from './claude-history-lines'

// Claude writes one meta-flagged record per skill use, naming the folder the skill was read from.
// Only that folder is carried; the rest of the record is the whole SKILL.md body.
const SKILL_DIRECTORY = 'Base directory for this skill: '

// Recorded folders, under the id of the record that invoked the skill and, for a Skill call, under
// the call id as well.
export type ClaudeSkillDirectories = ReadonlyMap<string, string>

function firstText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const block = jsonObject(content[0])
  return block?.type === 'text' && typeof block.text === 'string' ? block.text : null
}

// A record that is merely quoting the phrase is not a recorded folder; only a meta-flagged user
// record whose own first text block opens with it is.
function recordedDirectory(record: Record<string, unknown>): string | null {
  if (record.type !== 'user' || record.isMeta !== true || record.isSidechain === true) return null
  const text = firstText(jsonObject(record.message)?.content)
  if (text === null || !text.startsWith(SKILL_DIRECTORY)) return null
  const folder = text.slice(SKILL_DIRECTORY.length).split('\n')[0]?.trim()
  return folder === undefined || folder === '' ? null : folder
}

// The tool call a `tool_result` record answered, so a Skill call finds the folder recorded after it.
function answeredCallId(record: Record<string, unknown> | null): string | null {
  const content = jsonObject(record?.message)?.content
  if (!Array.isArray(content)) return null
  for (const raw of content) {
    const block = jsonObject(raw)
    if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string')
      return block.tool_use_id
  }
  return null
}

// The keys one meta record's folder is filed under: the record it answers, and, when the line
// before it is that very record, the tool call it answered.
function recordedKeys(
  line: string,
  before: string | null,
): { keys: string[]; folder: string } | null {
  const record = historyRecord(line)
  if (record === null) return null
  const folder = recordedDirectory(record)
  const parentUuid = typeof record.parentUuid === 'string' ? record.parentUuid : null
  if (folder === null || parentUuid === null) return null
  const invocation = before === null ? null : historyRecord(before)
  const callId = invocation?.uuid === parentUuid ? answeredCallId(invocation) : null
  return { keys: callId === null ? [parentUuid] : [parentUuid, callId], folder }
}

// Claude writes the meta record straight after the invocation it belongs to, so only lines holding
// the phrase are parsed, with the line before each one for the call it answered.
function scanSkillDirectories(
  into: Map<string, string>,
  lines: readonly string[],
  before: string | null,
): string | null {
  let previous = before
  for (const line of lines) {
    const candidate = previous
    previous = line
    if (!line.includes(SKILL_DIRECTORY)) continue
    const recorded = recordedKeys(line, candidate)
    if (recorded === null) continue
    for (const key of recorded.keys) into.set(key, recorded.folder)
  }
  return previous
}

export function claudeSkillDirectories(lines: readonly string[]): ClaudeSkillDirectories {
  const directories = new Map<string, string>()
  scanSkillDirectories(directories, lines, null)
  return directories
}

// The folders a reader has seen so far, grown as it reads more lines of the same transcript.
export class ClaudeSkillDirectoryScan {
  readonly #directories = new Map<string, string>()
  #previous: string | null = null

  read(lines: readonly string[]): void {
    this.#previous = scanSkillDirectories(this.#directories, lines, this.#previous)
  }

  get directories(): ClaudeSkillDirectories {
    return this.#directories
  }
}

function claudeHistoryDirectory(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')
}

function transcriptFile(nativeId: string, directory: string): string | null {
  let projects: string[]
  try {
    projects = readdirSync(directory)
  } catch {
    return null
  }
  for (const project of projects) {
    const file = path.join(directory, project, `${nativeId}.jsonl`)
    if (existsSync(file)) return file
  }
  return null
}

// The folders one Session's transcript recorded, read straight from the file, which the SDK reads
// with every meta record already dropped.
export function readClaudeSkillDirectories(
  nativeId: string,
  directory = claudeHistoryDirectory(),
): ClaudeSkillDirectories {
  const file = transcriptFile(nativeId, directory)
  if (file === null) return new Map()
  try {
    return claudeSkillDirectories(readFileSync(file, 'utf8').split('\n'))
  } catch {
    return new Map()
  }
}
