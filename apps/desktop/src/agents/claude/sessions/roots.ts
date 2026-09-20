import path from 'node:path'
import process from 'node:process'
import { SESSION_CLAUDE_TRANSCRIPTS_ENV } from '@/domains/sessions/main/composition/proof-protocol'

export function claudeTranscriptsRoot(home: string): string {
  return process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] ?? path.join(home, '.claude', 'projects')
}

// The user-level settings Argo adds its one `PreCompact` hook to (ADR-0041).
export function claudeSettingsPath(home: string): string {
  return path.join(home, '.claude', 'settings.json')
}

// Fixed under home rather than `userData`, so a dev instance and the app share one hook.
export function claudeCompactionStartsRoot(home: string): string {
  return path.join(home, '.claude', 'argo-compactions')
}

// One file per running `claude` process, read for which Session it holds (`sessions/live-processes.ts`).
export function claudeProcessesRoot(home: string): string {
  return path.join(home, '.claude', 'sessions')
}
