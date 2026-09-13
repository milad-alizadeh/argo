import { Plug } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { AccountSummary } from '@/core/accounts/contract'
import type { TicketScope } from '@/core/tickets/contract'

import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import type { ContractFailure } from '../../../lib/query-client'
import { PROVIDER_PRESENTATION } from '../../accounts/lib/providers'
import { SOURCE_PRESENTATION } from '../lib/sources'
import { offered, type SourceDiscovery, SourceField } from './SourceField'

export type ConnectTarget = { accountId: string; scope: string }

export type ConnectSourceFormProps = {
  projectName: string
  accounts: readonly AccountSummary[]
  // The connected Account whose sources are offered, or null when none is connected.
  accountId: string | null
  sources: SourceDiscovery
  pending: boolean
  error: ContractFailure | null
  onSelectAccount: (accountId: string) => void
  onConnectSource: (target: ConnectTarget) => void
  onConnectAccount: () => void
}

function NoAccount({ onConnectAccount }: { onConnectAccount: () => void }) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Plug aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Connect an Account to read Tickets</EmptyTitle>
        <EmptyDescription>
          A Project reads its Tickets through a connected GitHub or Linear Account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onConnectAccount}>Connect an Account</Button>
      </EmptyContent>
    </Empty>
  )
}

// The provider decides whether the source is readable; the form only refuses to send nothing.
export function ConnectSourceForm({
  projectName,
  accounts,
  accountId,
  sources,
  pending,
  error,
  onSelectAccount,
  onConnectSource,
  onConnectAccount,
}: ConnectSourceFormProps) {
  const [scope, setScope] = useState<TicketScope | null>(null)
  const [missingScope, setMissingScope] = useState(false)
  const connected = accounts.filter((account) => account.state === 'connected')
  const chosen = connected.find((account) => account.id === accountId)
  if (!chosen) return <NoAccount onConnectAccount={onConnectAccount} />
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setMissingScope(scope === null)
    if (scope !== null) onConnectSource({ accountId: chosen.id, scope: scope.scope })
  }
  const noun = PROVIDER_PRESENTATION[chosen.provider].scope.one
  const choices = connected.map((account) => ({
    value: account.id,
    label: `${PROVIDER_PRESENTATION[account.provider].name} · ${account.login}`,
  }))
  const problem = error?.message ?? (missingScope ? `Choose a ${noun}.` : null)
  return (
    <div className="grid h-full place-items-center p-(--spacing-shell-region)">
      <Card className="w-full max-w-md">
        <form aria-label="Connect a Ticket source" className="contents" onSubmit={submit}>
          <CardHeader>
            <CardTitle>
              <h2 className="type-heading">
                Connect {projectName} to a {noun}
              </h2>
            </CardTitle>
            <CardDescription>
              Argo reads this {noun}'s open {SOURCE_PRESENTATION[chosen.provider].items} as the
              Project's Tickets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="connect-account">Account</FieldLabel>
                <Select
                  items={choices}
                  onValueChange={(next) => {
                    if (next === null) return
                    setScope(null)
                    setMissingScope(false)
                    onSelectAccount(next)
                  }}
                  value={chosen.id}
                >
                  <SelectTrigger className="w-full" id="connect-account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <SourceField
                login={chosen.login}
                onChange={(next) => {
                  setScope(next)
                  setMissingScope(false)
                }}
                pending={pending}
                problem={problem}
                provider={chosen.provider}
                scope={scope}
                sources={sources}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={pending || offered(sources).length === 0} type="submit">
              {pending ? `Checking the ${noun}…` : `Connect ${noun}`}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
