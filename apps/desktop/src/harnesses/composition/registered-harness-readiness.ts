// Every Harness's readiness probe and sign-in driver (#2579). A new Harness is a new entry here,
// with its own module beside its adapter (`harnesses/<name>/readiness/`) — no other shared code
// names a Harness's status shape or its login command.
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import {
  HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV,
  HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV,
} from '@/domains/harness-signin/contract/proof-protocol'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main/harness-readiness-registration'
import { createClaudeSignInDriver } from '@/harnesses/claude/readiness/claude-sign-in-driver'
import { createSystemClaudeReadiness } from '@/harnesses/claude/readiness/system-claude-readiness'
import { createCodexSignInDriver } from '@/harnesses/codex/readiness/codex-sign-in-driver'
import { createSystemCodexReadiness } from '@/harnesses/codex/readiness/system-codex-readiness'

// A proof that never sets this Harness's executable override isn't testing sign-in at all, and
// must not fall through to a login-shell PATH lookup: that reads whatever `claude`/`codex` happen
// to be on the machine running the proof, `ready` on a workstation that has them and `missing` on
// a CI runner that does not (#2622). Assume ready instead, the same baseline every other proof
// fixture had before this gate existed.
function assumeReady(harness: HarnessReadiness['harness']): () => Promise<HarnessReadiness> {
  return async () => ({ harness, state: 'ready', detail: null })
}

// `executable` overrides are read only on a proof run, mirroring the Session-drive seam
// (`session-harness.ts` reading `SESSION_CLAUDE_EXECUTABLE_ENV` only `if (proofEnabled)`).
export function createHarnessReadinessRegistrations({
  proofEnabled,
}: {
  proofEnabled: boolean
}): readonly HarnessReadinessRegistration[] {
  const claudeExecutable = proofEnabled
    ? process.env[HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]
    : undefined
  const codexExecutable = proofEnabled
    ? process.env[HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]
    : undefined
  return [
    {
      harness: 'claude',
      checkReadiness:
        proofEnabled && claudeExecutable === undefined
          ? assumeReady('claude')
          : createSystemClaudeReadiness(claudeExecutable),
      signIn: createClaudeSignInDriver(claudeExecutable),
    },
    {
      harness: 'codex',
      checkReadiness:
        proofEnabled && codexExecutable === undefined
          ? assumeReady('codex')
          : createSystemCodexReadiness(codexExecutable),
      signIn: createCodexSignInDriver(codexExecutable),
    },
  ]
}
