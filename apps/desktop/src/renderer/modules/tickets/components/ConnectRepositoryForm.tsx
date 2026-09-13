import { Plug } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import type { AccountSummary } from '@/core/accounts/contract'

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
import { Field, FieldError, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { NativeSelect, NativeSelectOption } from '../../../components/ui/native-select'
import type { ContractFailure } from '../../../lib/query-client'

export type ConnectTarget = { accountId: string; scope: string }

export type ConnectRepositoryFormProps = {
  projectName: string
  accounts: readonly AccountSummary[]
  pending: boolean
  error: ContractFailure | null
  onConnectRepository: (target: ConnectTarget) => void
  onConnectAccount: () => void
}

function NoAccount({ onConnectAccount }: { onConnectAccount: () => void }) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Plug aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Connect GitHub to read Tickets</EmptyTitle>
        <EmptyDescription>
          A Project reads its Tickets through a connected GitHub Account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onConnectAccount}>Connect GitHub</Button>
      </EmptyContent>
    </Empty>
  )
}

// GitHub decides whether the repository is readable; the form only refuses to send nothing.
export function ConnectRepositoryForm({
  projectName,
  accounts,
  pending,
  error,
  onConnectRepository,
  onConnectAccount,
}: ConnectRepositoryFormProps) {
  const connected = accounts.filter((account) => account.state === 'connected')
  const [accountId, setAccountId] = useState(connected[0]?.id ?? '')
  const [scope, setScope] = useState('')
  const [missingScope, setMissingScope] = useState(false)
  if (connected.length === 0) return <NoAccount onConnectAccount={onConnectAccount} />
  const chosen = connected.some((account) => account.id === accountId)
    ? accountId
    : connected[0]?.id
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedScope = scope.trim()
    if (trimmedScope === '') {
      setMissingScope(true)
      return
    }
    setMissingScope(false)
    if (chosen) onConnectRepository({ accountId: chosen, scope: trimmedScope })
  }
  return (
    <div className="grid h-full place-items-center p-(--spacing-shell-region)">
      <Card className="w-full max-w-md">
        <form aria-label="Connect a repository" className="contents" onSubmit={submit}>
          <CardHeader>
            <CardTitle>
              <h2 className="type-heading">Connect {projectName} to a repository</h2>
            </CardTitle>
            <CardDescription>
              Argo reads this repository's open GitHub Issues as the Project's Tickets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="connect-account">GitHub Account</FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="connect-account"
                  onChange={(event) => setAccountId(event.target.value)}
                  value={chosen}
                >
                  {connected.map((account) => (
                    <NativeSelectOption key={account.id} value={account.id}>
                      {account.login}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={error || missingScope ? true : undefined}>
                <FieldLabel htmlFor="connect-scope">Repository</FieldLabel>
                <Input
                  aria-describedby={error || missingScope ? 'connect-scope-error' : undefined}
                  aria-invalid={error || missingScope ? true : undefined}
                  autoComplete="off"
                  id="connect-scope"
                  onChange={(event) => {
                    setScope(event.target.value)
                    if (missingScope) setMissingScope(false)
                  }}
                  placeholder="owner/name"
                  spellCheck={false}
                  value={scope}
                />
                {error || missingScope ? (
                  <FieldError id="connect-scope-error">
                    {error?.message ?? 'Enter the GitHub repository as owner/name.'}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={pending} type="submit">
              {pending ? 'Checking the repository…' : 'Connect repository'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
