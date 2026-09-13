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

// The repositories the chosen Account can see, read from GitHub before the form can offer one.
export type RepositoryDiscovery =
  | { state: 'loading' }
  | { state: 'failed'; message: string; onRetry: () => void }
  | { state: 'listed'; scopes: readonly string[] }

const NOTE_ID = 'connect-scope-note'

type RepositoryFieldProps = {
  login: string
  repositories: RepositoryDiscovery
  scope: string | null
  problem: string | null
  pending: boolean
  onChange: (scope: string | null) => void
}

// What the field says under the input: a refusal first, then how the discovery stands.
function RepositoryNote({ login, repositories, problem }: RepositoryFieldProps) {
  if (problem) return <FieldError id={NOTE_ID}>{problem}</FieldError>
  switch (repositories.state) {
    case 'loading':
      return (
        <FieldDescription id={NOTE_ID} role="status">
          Reading the repositories {login} can see…
        </FieldDescription>
      )
    case 'failed':
      return (
        <div className="flex items-center justify-between gap-(--spacing-shell-item)">
          <FieldError id={NOTE_ID}>{repositories.message}</FieldError>
          <Button onClick={repositories.onRetry} size="sm" type="button" variant="outline">
            Read repositories again
          </Button>
        </div>
      )
    case 'listed':
      return repositories.scopes.length === 0 ? (
        <FieldDescription id={NOTE_ID}>
          {login} cannot see any repository with GitHub Issues turned on.
        </FieldDescription>
      ) : null
    default:
      return repositories satisfies never
  }
}

export const offered = (repositories: RepositoryDiscovery) =>
  repositories.state === 'listed' ? repositories.scopes : []

export function RepositoryField(props: RepositoryFieldProps) {
  const { repositories, scope, problem, pending, onChange } = props
  const scopes = offered(repositories)
  const disabled = pending || scopes.length === 0
  const described = problem !== null || repositories.state !== 'listed' || scopes.length === 0
  return (
    <Field data-invalid={problem ? true : undefined}>
      <FieldLabel htmlFor="connect-scope">Repository</FieldLabel>
      <Combobox
        autoHighlight
        disabled={disabled}
        items={scopes}
        onValueChange={onChange}
        value={scope}
      >
        <ComboboxInput
          aria-describedby={described ? NOTE_ID : undefined}
          aria-invalid={problem ? true : undefined}
          className="w-full"
          disabled={disabled}
          id="connect-scope"
          placeholder="Search owner/name"
          spellCheck={false}
        />
        <ComboboxContent>
          <ComboboxEmpty>No repository matches.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <RepositoryNote {...props} />
    </Field>
  )
}
