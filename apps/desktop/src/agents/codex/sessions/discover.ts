import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import { parseCodexTranscriptLine } from './records'

export type Discovery = TranscriptDiscovery

async function directories(root: string): Promise<string[]> {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
}

async function transcriptPathsInDay(root: string) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => ({ path: path.join(root, entry.name), name: sessionIdFileName(entry.name) }))
}

function sessionIdFileName(fileName: string) {
  const sessionId = fileName.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.jsonl$/i)?.[1]
  return sessionId === undefined ? fileName : `${sessionId}.jsonl`
}

async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const years = await directories(root)
  const months = (await Promise.all(years.map(directories))).flat()
  const days = (await Promise.all(months.map(directories))).flat()
  return (await Promise.all(days.map(transcriptPathsInDay))).flat()
}

const reader = createTranscriptDiscoverer({
  cli: 'codex',
  transcriptPaths,
  parse: parseCodexTranscriptLine,
})

export const { discoverSessions, readSessionFiles } = reader
