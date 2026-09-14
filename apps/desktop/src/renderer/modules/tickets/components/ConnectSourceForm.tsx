import { Plug } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { contractText } from '../../../i18n/contract-text'
import type { ContractFailure } from '../../../lib/query-client'
import { providerPresentation } from '../../accounts/lib/providers'
import { sourcePresentation } from '../lib/sources'
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
  const { t } = useTranslation('tickets')
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Plug aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('connect.form.noAccount.title')}</EmptyTitle>
        <EmptyDescription>{t('connect.form.noAccount.description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onConnectAccount}>{t('connect.form.noAccount.connect')}</Button>
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
  const { t } = useTranslation('tickets')
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
  const noun = providerPresentation(chosen.provider).scope.one
  const choices = connected.map((account) => ({
    value: account.id,
    label: `${providerPresentation(account.provider).name} · ${account.login}`,
  }))
  const problem = ((): string | null => {
    if (error) return contractText(error)
    if (missingScope) return t('connect.form.missingScope', { noun })
    return null
  })()
  return (
    <div className="grid h-full place-items-center p-(--spacing-shell-region)">
      <Card className="w-full max-w-md">
        <form aria-label={t('connect.form.label')} className="contents" onSubmit={submit}>
          <CardHeader>
            <CardTitle>
              <h2 className="type-heading">
                {t('connect.form.heading', { project: projectName, noun })}
              </h2>
            </CardTitle>
            <CardDescription>
              {t('connect.form.description', {
                noun,
                items: sourcePresentation(chosen.provider).items,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="connect-account">{t('connect.form.account')}</FieldLabel>
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
              {pending ? t('connect.form.checking', { noun }) : t('connect.form.submit', { noun })}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
