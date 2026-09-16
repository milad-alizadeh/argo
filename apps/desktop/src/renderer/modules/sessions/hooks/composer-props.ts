import type { SessionComposerProps } from '../components/composer/session-composer'
import { type ComposerIdentity, composerIdentityKey } from './composer-identity'
import { managedSessionIsRunning } from './use-composer-actions'
import type { useSessions } from './use-sessions'

export function composerProps(input: {
  roster: ReturnType<typeof useSessions>['roster']
  sessionId: string | null
  focusOnMount: boolean
  isCompacting: boolean
  isHandingOff: boolean
  onCompact: (() => Promise<boolean>) | undefined
  onHandoff: (() => Promise<boolean>) | undefined
  onInterrupt: () => Promise<boolean>
  onSend: SessionComposerProps['onSend']
  identity: ComposerIdentity
  control: SessionComposerProps['setup']
}): Omit<SessionComposerProps, 'plan' | 'harness'> {
  const { roster, sessionId, identity, control, ...rest } = input
  return {
    ...rest,
    isRunning: managedSessionIsRunning(roster, sessionId),
    sessionId: composerIdentityKey(identity),
    setup: control,
  }
}
