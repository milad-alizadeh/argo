import type { SessionComposerProps } from '../components/SessionComposer'
import type { ComposerIdentity } from './composerIdentity'

export function sessionComposerProps({
  identity,
  ...props
}: Omit<SessionComposerProps, 'harness' | 'plan'> & {
  identity: ComposerIdentity
}) {
  return {
    ...props,
    onCompact: identity.kind === 'session' ? props.onCompact : undefined,
  }
}
