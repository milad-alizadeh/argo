import path from 'node:path'
import process from 'node:process'
// Relative, not `@/`: the proof driver bundles this file, and bun 1.3.3 (CI's pin) leaves the
// alias external, so the built `.mjs` dies on `Cannot find package '@/core'`.
import { SESSION_CODEX_TRANSCRIPTS_ENV } from '@/domains/sessions/main/proof-protocol'

export function codexTranscriptsRoot(home: string): string {
  return process.env[SESSION_CODEX_TRANSCRIPTS_ENV] ?? path.join(home, '.codex', 'sessions')
}

// Codex keeps its app state beside `sessions/`, so a proof's fixture root never reaches the real one.
export function codexStatePath(transcriptsRoot: string): string {
  return path.join(path.dirname(transcriptsRoot), 'state_5.sqlite')
}
