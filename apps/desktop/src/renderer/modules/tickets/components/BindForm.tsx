import { type FormEvent, useState } from 'react'

import type { AccountSummary } from '@/core/accounts/contract'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { NativeSelect, NativeSelectOption } from '../../../components/ui/native-select'
import type { ContractFailure } from '../../../lib/query-client'

export type BindTarget = { accountId: string; scope: string }

export type BindFormProps = {
  projectName: string
  accounts: readonly AccountSummary[]
  pending: boolean
  error: ContractFailure | null
  onBind: (target: BindTarget) => void
  onConnect: () => void
}

function NoAccount({ onConnect }: { onConnect: () => void }) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyTitle>Connect GitHub to read Tickets</EmptyTitle>
        <EmptyDescription>
          A Project reads its Tickets through a connected GitHub Account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onConnect}>Connect GitHub</Button>
      </EmptyContent>
    </Empty>
  )
}

// GitHub decides whether the repository is readable; the form only refuses to send nothing.
export function BindForm({
  projectName,
  accounts,
  pending,
  error,
  onBind,
  onConnect,
}: BindFormProps) {
  const connected = accounts.filter((account) => account.state === 'connected')
  const [accountId, setAccountId] = useState(connected[0]?.id ?? '')
  const [scope, setScope] = useState('')
  if (connected.length === 0) return <NoAccount onConnect={onConnect} />
  const chosen = connected.some((account) => account.id === accountId)
    ? accountId
    : connected[0]?.id
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (chosen) onBind({ accountId: chosen, scope: scope.trim() })
  }
  return (
    <form
      aria-label="Bind a repository"
      className="grid w-full max-w-md gap-(--spacing-shell-inset)"
      onSubmit={submit}
    >
      <div className="grid gap-(--spacing-shell-tight)">
        <h2 className="type-heading">Bind {projectName} to a repository</h2>
        <p className="type-meta text-muted-foreground">
          Argo reads this repository's open GitHub Issues as the Project's Tickets.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="bind-account">GitHub Account</FieldLabel>
          <NativeSelect
            className="w-full"
            id="bind-account"
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
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="bind-scope">Repository</FieldLabel>
          <Input
            aria-describedby={error ? 'bind-scope-error' : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            id="bind-scope"
            onChange={(event) => setScope(event.target.value)}
            placeholder="owner/name"
            spellCheck={false}
            value={scope}
          />
          {error ? <FieldError id="bind-scope-error">{error.message}</FieldError> : null}
        </Field>
      </FieldGroup>
      <Button
        className="justify-self-start"
        disabled={pending || scope.trim() === ''}
        type="submit"
      >
        {pending ? 'Checking the repository…' : 'Bind repository'}
      </Button>
    </form>
  )
}
