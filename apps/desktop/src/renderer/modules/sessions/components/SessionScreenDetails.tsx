import type { SessionRosterRow } from '@/core/sessions/models'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import type { HarnessControl } from '../harness/harnesses'
import { ClaudePermissionPrompt } from './ClaudePermissionPrompt'
import { COMPOSER_COLUMN } from './ComposerForm'
import { SessionComposer } from './SessionComposer'

type SessionScreenDetailsProps = {
  composer: Pick<
    ReturnType<typeof import('../hooks/useSessionComposer').useSessionComposer>,
    'failure' | 'props'
  >
  permission: ReturnType<typeof import('../hooks/useSessionPermission').useSessionPermission>
  session: SessionRosterRow | null
  harness: HarnessControl
}

export function SessionComposerArea({
  composer,
  permission,
  session,
  harness,
}: SessionScreenDetailsProps) {
  return (
    <>
      {composer.failure ? <Failure message={composer.failure} /> : null}
      {permission.failure ? <Failure message={permission.failure} /> : null}
      {permission.permission ? (
        <ClaudePermissionPrompt permission={permission.permission} onDecide={permission.decide} />
      ) : null}
      <SessionComposer
        {...composer.props}
        contextTokens={session?.contextTokens}
        harness={harness}
        plan={session?.plan ?? null}
      />
    </>
  )
}

export function SessionWorkInspector({ session }: Pick<SessionScreenDetailsProps, 'session'>) {
  if (session === null || (session.delegations.length === 0 && session.shell.length === 0))
    return null
  return (
    <section aria-label="Session work" className="p-4 type-meta text-muted-foreground">
      {session.delegations.length > 0 ? (
        <div>
          <h2 className="font-medium text-foreground">Subagents</h2>
          {session.delegations.map((delegation) => (
            <p className="mt-2" key={delegation.id}>
              {delegation.label ?? delegation.id}
            </p>
          ))}
        </div>
      ) : null}
      {session.shell.length > 0 ? (
        <div className={session.delegations.length > 0 ? 'mt-4' : undefined}>
          <h2 className="font-medium text-foreground">Shell</h2>
          {session.shell.map((command) => (
            <p className="mt-2 font-mono" key={command.id}>
              {command.command ?? command.id}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <div className={`${COMPOSER_COLUMN} mt-3`}>
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  )
}
