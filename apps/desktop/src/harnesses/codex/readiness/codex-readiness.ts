// Codex's `login status` is plain text, not JSON (grounded live against codex-cli 0.147.0): exit
// 0 and "Logged in using ChatGPT" when ready, or a nonzero exit with a line containing "Not logged
// in" when signed out. Codex carries no ban on API-key auth, so any "Logged in" text still counts
// as ready. There is no grounded policy-blocked signal for Codex yet, so an unrecognized failure
// reads as signed-out rather than a fabricated policy-blocked heuristic (#2579).
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'

export type CodexStatusResult = { stdout: string; stderr: string }
export type CodexStatusRunner = () => Promise<CodexStatusResult>

export async function codexReadiness(deps: {
  findExecutable: () => string | null
  runStatus: CodexStatusRunner
}): Promise<HarnessReadiness> {
  if (!deps.findExecutable()) return { harness: 'codex', state: 'missing', detail: null }
  const { stdout, stderr } = await deps.runStatus()
  const text = `${stdout}\n${stderr}`
  if (/logged in/i.test(text) && !/not logged in/i.test(text)) {
    return { harness: 'codex', state: 'ready', detail: null }
  }
  if (/not logged in/i.test(text)) return { harness: 'codex', state: 'signed-out', detail: null }
  return { harness: 'codex', state: 'signed-out', detail: 'unrecognized-status' }
}
