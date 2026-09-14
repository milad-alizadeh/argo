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
  return {
    ...props,
    onCompact: cli === 'claude' && identity.kind === 'session' ? props.onCompact : undefined,
  }
}
