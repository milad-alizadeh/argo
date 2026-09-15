import path from 'node:path'
import process from 'node:process'
import { SESSION_CODEX_TRANSCRIPTS_ENV } from '@/core/sessions/proof-protocol'

export function codexTranscriptsRoot(home: string): string {
  return process.env[SESSION_CODEX_TRANSCRIPTS_ENV] ?? path.join(home, '.codex', 'sessions')
}
