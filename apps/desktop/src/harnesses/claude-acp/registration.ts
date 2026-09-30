import path from 'node:path'
import { createAcpRegistration } from '@/harnesses/acp/acp-registration-factory'
import { claudeCliEnvironment } from '@/harnesses/claude/cli-environment'
import type { AvailableHarness } from '@/harnesses/harness-catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import type { HarnessRegistration } from '@/harnesses/registration'
import { en as copy } from './locales'
import { SESSION_CLAUDE_ACP_EXECUTABLE_ENV } from './proof-protocol'
import { createClaudeAcpReadiness, createClaudeAcpSignInDriver } from './readiness'

type ModeIcon = AvailableHarness['modes'][number]['icon']

// The modes `claude-agent-acp` reports; another mode draws as the manual one.
const modeIcons: Record<string, ModeIcon> = {
  default: 'mode-manual',
  acceptEdits: 'mode-accept-edits',
  plan: 'mode-plan',
  auto: 'mode-auto',
  dontAsk: 'mode-dont-ask',
  bypassPermissions: 'mode-bypass-permissions',
}

export function createClaudeAcpRegistration(): HarnessRegistration<'claude-acp'> {
  const executable =
    process.env[SESSION_CLAUDE_ACP_EXECUTABLE_ENV] ??
    findExecutableOnLoginShellPath('claude-agent-acp')
  const checkReadiness = createClaudeAcpReadiness(() => executable)
  const environment = claudeCliEnvironment()
  return createAcpRegistration({
    harness: 'claude-acp',
    checkReadiness,
    signIn: createClaudeAcpSignInDriver(checkReadiness),
    // The agent is a node script; a GUI launch's bare PATH must still find the node beside it.
    command: () =>
      executable === null
        ? null
        : {
            executable,
            args: [],
            env: {
              ...environment,
              PATH: [path.dirname(executable), environment.PATH]
                .filter(Boolean)
                .join(path.delimiter),
            },
          },
    catalog: {
      agent: 'Claude',
      label: copy.presentation.label,
      modeIcon: (value) => modeIcons[value] ?? 'mode-manual',
    },
  })
}
