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
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { NativeSelect, NativeSelectOption } from '../../../components/ui/native-select'
import type { ContractFailure } from '../../../lib/query-client'
import { offered, type RepositoryDiscovery, RepositoryField } from './RepositoryField'

export type ConnectTarget = { accountId: string; scope: string }

export type ConnectRepositoryFormProps = {
  projectName: string
  accounts: readonly AccountSummary[]
  // The connected Account whose repositories are offered, or null when none is connected.
  accountId: string | null
  repositories: RepositoryDiscovery
  pending: boolean
  error: ContractFailure | null
  onSelectAccount: (accountId: string) => void
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
  accountId,
  repositories,
  pending,
  error,
  onSelectAccount,
  onConnectRepository,
  onConnectAccount,
}: ConnectRepositoryFormProps) {
  const [scope, setScope] = useState<string | null>(null)
  const [missingScope, setMissingScope] = useState(false)
  const connected = accounts.filter((account) => account.state === 'connected')
  const chosen = connected.find((account) => account.id === accountId)
  if (!chosen) return <NoAccount onConnectAccount={onConnectAccount} />
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setMissingScope(scope === null)
    if (scope !== null) onConnectRepository({ accountId: chosen.id, scope })
  }
  const problem = error?.message ?? (missingScope ? 'Choose a repository.' : null)
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
                  onChange={(event) => {
                    setScope(null)
                    setMissingScope(false)
                    onSelectAccount(event.target.value)
                  }}
                  value={chosen.id}
                >
                  {connected.map((account) => (
                    <NativeSelectOption key={account.id} value={account.id}>
                      {account.login}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <RepositoryField
                login={chosen.login}
                onChange={(next) => {
                  setScope(next)
                  setMissingScope(false)
                }}
                pending={pending}
                problem={problem}
                repositories={repositories}
                scope={scope}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={pending || offered(repositories).length === 0} type="submit">
              {pending ? 'Checking the repository…' : 'Connect repository'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
