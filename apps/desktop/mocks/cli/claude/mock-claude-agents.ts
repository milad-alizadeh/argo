// A mock `claude` executable that answers `claude agents --json` with what a test sets, starting
// from the recorded 2.1.286 output. With no answer set, the command fails.
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import recorded from './fixtures/agents-claude-2.1.286.json' with { type: 'json' }

type RecordedEntry = Record<string, unknown> & { sessionId: string }

export function mockClaudeAgentsCli() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-agents-'))
  const executable = path.join(root, 'claude')
  const answerFile = path.join(root, 'agents.json')
  writeFileSync(
    executable,
    [
      '#!/bin/sh',
      '[ "$*" = "agents --json" ] || exit 2',
      `[ -f "${answerFile}" ] || { echo "agents failed" >&2; exit 1; }`,
      `cat "${answerFile}"`,
      '',
    ].join('\n'),
  )
  chmodSync(executable, 0o755)
  return {
    executable,
    // The recorded entries: idle, busy, waiting on a dialog, and a background Session.
    recorded: (): RecordedEntry[] => structuredClone(recorded.output),
    // What the next runs print: entries as JSON, or raw text as it stands.
    answer(output: readonly unknown[] | string) {
      writeFileSync(answerFile, typeof output === 'string' ? output : JSON.stringify(output))
    },
    fail() {
      rmSync(answerFile, { force: true })
    },
    dispose() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
