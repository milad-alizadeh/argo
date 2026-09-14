import type { SessionComposerProps } from '../components/SessionComposer'
import type { SessionCli } from '../harness/harnesses'
import type { ComposerIdentity } from './composerIdentity'

export function sessionComposerProps({
  cli,
  identity,
  ...props
}: Omit<SessionComposerProps, 'harness' | 'plan'> & {
  cli: SessionCli
  identity: ComposerIdentity
}) {
  const managed = cli === 'claude' && identity.kind === 'session'
  return {
    ...props,
    onCompact: managed ? props.onCompact : undefined,
    onHandoff: managed ? props.onHandoff : undefined,
  }
}
