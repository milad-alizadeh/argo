import type { SessionComposerProps } from '../components/SessionComposer'
import type { SessionCli } from '../harness/harnesses'

export function sessionComposerProps({
  cli,
  selectedSessionId,
  ...props
}: Omit<SessionComposerProps, 'harness' | 'plan'> & {
  cli: SessionCli
  selectedSessionId: string | null
}) {
  return {
    ...props,
    onCompact: cli === 'claude' && selectedSessionId !== null ? props.onCompact : undefined,
  }
}
