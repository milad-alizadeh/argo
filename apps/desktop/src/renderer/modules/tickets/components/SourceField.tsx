import type { Provider } from '@/core/accounts/contract'
import type { TicketScope } from '@/core/tickets/contract'
import { Button } from '../../../components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../../../components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../../components/ui/field'
import { capitalized, PROVIDER_PRESENTATION } from '../../accounts/lib/providers'
import { SOURCE_PRESENTATION } from '../lib/sources'

// The sources the chosen Account can see, read from its provider before the form can offer one.
export type SourceDiscovery =
  | { state: 'loading' }
  | { state: 'failed'; message: string; onRetry: () => void }
  | { state: 'listed'; scopes: readonly TicketScope[] }

const NOTE_ID = 'connect-scope-note'

type SourceFieldProps = {
  provider: Provider
  login: string
  sources: SourceDiscovery
  scope: TicketScope | null
  problem: string | null
  pending: boolean
  onChange: (scope: TicketScope | null) => void
}

// What the field says under the input: a refusal first, then how the discovery stands.
function SourceNote({ provider, login, sources, problem }: SourceFieldProps) {
  if (problem) return <FieldError id={NOTE_ID}>{problem}</FieldError>
  const { scope } = PROVIDER_PRESENTATION[provider]
  switch (sources.state) {
    case 'loading':
      return (
        <FieldDescription id={NOTE_ID} role="status">
          Reading the {scope.many} {login} can see…
        </FieldDescription>
      )
    case 'failed':
      return (
        <div className="flex items-center justify-between gap-(--spacing-shell-item)">
          <FieldError id={NOTE_ID}>{sources.message}</FieldError>
          <Button onClick={sources.onRetry} size="sm" type="button" variant="outline">
            Read {scope.many} again
          </Button>
        </div>
      )
    case 'listed':
      return sources.scopes.length === 0 ? (
        <FieldDescription id={NOTE_ID}>
          {SOURCE_PRESENTATION[provider].noScopes(login)}
        </FieldDescription>
      ) : null
    default:
      return sources satisfies never
  }
}

export const offered = (sources: SourceDiscovery) =>
  sources.state === 'listed' ? sources.scopes : []

const scopeLabel = (item: TicketScope) => item.label
const scopeValue = (item: TicketScope) => item.scope
const sameScope = (item: TicketScope, value: TicketScope) => item.scope === value.scope

export function SourceField(props: SourceFieldProps) {
  const { provider, sources, scope, problem, pending, onChange } = props
  const noun = PROVIDER_PRESENTATION[provider].scope
  const scopes = offered(sources)
  const disabled = pending || scopes.length === 0
  const described = problem !== null || sources.state !== 'listed' || scopes.length === 0
  return (
    <Field data-invalid={problem ? true : undefined}>
      <FieldLabel htmlFor="connect-scope">{capitalized(noun.one)}</FieldLabel>
      <Combobox
        autoHighlight
        disabled={disabled}
        isItemEqualToValue={sameScope}
        items={scopes}
        itemToStringLabel={scopeLabel}
        itemToStringValue={scopeValue}
        onValueChange={onChange}
        value={scope}
      >
        <ComboboxInput
          aria-describedby={described ? NOTE_ID : undefined}
          aria-invalid={problem ? true : undefined}
          className="w-full"
          disabled={disabled}
          id="connect-scope"
          placeholder={SOURCE_PRESENTATION[provider].scopePlaceholder}
          spellCheck={false}
          triggerLabel={`Show ${noun.many}`}
        />
        <ComboboxContent>
          <ComboboxEmpty>No {noun.one} matches.</ComboboxEmpty>
          <ComboboxList>
            {(item: TicketScope) => (
              <ComboboxItem key={item.scope} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <SourceNote {...props} />
    </Field>
  )
}
