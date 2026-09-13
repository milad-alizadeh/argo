import type { SessionRosterRow } from '@/core/sessions/models'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { ClaudePermissionPrompt } from './ClaudePermissionPrompt'
import { SessionComposer } from './SessionComposer'

type SessionScreenDetailsProps = {
  composer: Pick<
    ReturnType<typeof import('../hooks/useClaudeComposer').useClaudeComposer>,
    'failure' | 'props'
  >
  permission: ReturnType<typeof import('../hooks/useClaudePermission').useClaudePermission>
  session: SessionRosterRow | null
}

export function SessionComposerArea({ composer, permission }: SessionScreenDetailsProps) {
  return (
    <>
      {composer.failure ? <Failure message={composer.failure} /> : null}
      {permission.failure ? <Failure message={permission.failure} /> : null}
      {permission.permission ? (
        <ClaudePermissionPrompt permission={permission.permission} onDecide={permission.decide} />
      ) : null}
      <SessionComposer {...composer.props} />
    </>
  )
}

export function SessionFacts({ session }: Pick<SessionScreenDetailsProps, 'session'>) {
  if (session === null) return null
  return (
    <section aria-label="Session facts" className="p-4 text-meta text-muted-foreground">
      <h2 className="font-medium text-foreground">Session facts</h2>
      <Fact
        label="Context"
        value={session.contextTokens}
        unavailable="Context is not available yet."
      />
      <Fact label="Usage" value={session.spentTokens} unavailable="Usage is not available yet." />
    </section>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <Alert className="mx-auto mt-3 max-w-4xl" variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function Fact({
  label,
  value,
  unavailable,
}: {
  label: string
  value: number | null | undefined
  unavailable: string
}) {
  return (
    <p className="mt-2">
      {value == null ? unavailable : `${label}: ${value.toLocaleString()} tokens`}
    </p>
  )
}
