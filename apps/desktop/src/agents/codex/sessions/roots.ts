import path from 'node:path'
import process from 'node:process'
import { SESSION_CODEX_TRANSCRIPTS_ENV } from '@/core/sessions/proof-protocol'

export function codexTranscriptsRoot(home: string): string {
  return process.env[SESSION_CODEX_TRANSCRIPTS_ENV] ?? path.join(home, '.codex', 'sessions')
}

// The user-level hooks file Argo adds its one `PreCompact` hook to (ADR-0041).
export function codexHooksPath(home: string): string {
  return path.join(home, '.codex', 'hooks.json')
}

// Fixed under home rather than `userData`, so a dev instance and the app share one hook.
export function codexCompactionStartsRoot(home: string): string {
  return path.join(home, '.codex', 'argo-compactions')
}
