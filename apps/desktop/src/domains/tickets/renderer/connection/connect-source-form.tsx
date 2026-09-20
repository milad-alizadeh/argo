import { Plug } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountSummary } from '@/domains/accounts/contract/contract'
import { providerPresentation } from '@/domains/accounts/renderer/lib/providers'
import type { TicketScope } from '@/domains/tickets/contract/contract'
import {
  offered,
  type SourceDiscovery,
  SourceField,
} from '@/domains/tickets/renderer/connection/source-field'
import { sourcePresentation } from '@/domains/tickets/renderer/lib/sources'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/platform/renderer/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/platform/renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import { contractText } from '@/platform/renderer/i18n/contract-text'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

export type ConnectTarget = { accountId: string; scope: string }

export type ConnectSourceFieldsProps = {
  accounts: readonly AccountSummary[]
  // The connected Account whose sources are offered, or null when none is connected.
  accountId: string | null
  sources: SourceDiscovery
  pending: boolean
  error: ContractFailure | null
  onSelectAccount: (accountId: string) => void
  onConnectSource: (target: ConnectTarget) => void
}

export type ConnectSourceFormProps = ConnectSourceFieldsProps & {
  projectName: string
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

// The Account dropdown, source search and submit button: shared by the full-page card shown
// before any Account is connected and the Accounts dialog's inline form once one is.
export function ConnectSourceFields({
  accounts,
  accountId,
  sources,
  pending,
  error,
  onSelectAccount,
  onConnectSource,
}: ConnectSourceFieldsProps) {
  const { t } = useTranslation('tickets')
  const [scope, setScope] = useState<TicketScope | null>(null)
  const [missingScope, setMissingScope] = useState(false)
  const connected = accounts.filter((account) => account.state === 'connected')
  const chosen = connected.find((account) => account.id === accountId)
  if (!chosen) return null
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
    <form aria-label={t('connect.form.label')} onSubmit={submit}>
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
      <div className="flex justify-end pt-(--spacing-shell-item)">
        <Button disabled={pending || offered(sources).length === 0} type="submit">
          {pending ? t('connect.form.checking', { noun }) : t('connect.form.submit', { noun })}
        </Button>
      </div>
    </form>
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
  const chosen = accounts
    .filter((account) => account.state === 'connected')
    .find((account) => account.id === accountId)
  if (!chosen) return <NoAccount onConnectAccount={onConnectAccount} />
  const noun = providerPresentation(chosen.provider).scope.one
  return (
    <div className="grid h-full place-items-center p-(--spacing-shell-region)">
      <Card className="w-full max-w-md">
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
          <ConnectSourceFields
            accountId={accountId}
            accounts={accounts}
            error={error}
            onConnectSource={onConnectSource}
            onSelectAccount={onSelectAccount}
            pending={pending}
            sources={sources}
          />
        </CardContent>
      </Card>
    </div>
  )
}
