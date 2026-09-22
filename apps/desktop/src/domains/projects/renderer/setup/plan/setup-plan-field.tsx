import { useTranslation } from 'react-i18next'
import {
  type SetupDocument,
  setupChoiceText,
  setupFieldText,
} from '@/domains/projects/contract/setup'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Input } from '@/platform/renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import type { SetupAnswer } from '../use-setup-answers'

export function SetupPlanField({
  document,
  field,
  language,
  mono,
  onChange,
  value,
}: {
  document: SetupDocument
  field: SetupDocument['fields'][number]
  language: string
  mono: boolean
  onChange: (value: SetupAnswer) => void
  value: SetupAnswer | undefined
}) {
  const text = setupFieldText(document, language, field.id)
  if (field.type === 'boolean') {
    return (
      <BooleanChoice
        checked={Boolean(value)}
        description={text.description}
        label={text.label}
        onChange={onChange}
        recommended={field.recommendation === true}
      />
    )
  }
  const descriptionId = text.description ? `${field.id}-description` : undefined
  return (
    <div className="block space-y-1.5">
      <label className="block type-body font-medium" htmlFor={field.id}>
        {text.label}
      </label>
      {text.description ? (
        <p className="type-label text-muted-foreground" id={descriptionId}>
          {text.description}
        </p>
      ) : null}
      {field.type === 'choice' ? (
        <ChoiceField
          describedBy={descriptionId}
          document={document}
          field={field}
          label={text.label}
          language={language}
          onChange={onChange}
          value={String(value ?? '')}
        />
      ) : (
        <Input
          aria-describedby={descriptionId}
          className={mono ? 'font-mono' : undefined}
          id={field.id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={String(value ?? '')}
        />
      )}
    </div>
  )
}

function ChoiceField({
  describedBy,
  document,
  field,
  label,
  language,
  onChange,
  value,
}: {
  describedBy: string | undefined
  document: SetupDocument
  field: Extract<SetupDocument['fields'][number], { type: 'choice' }>
  label: string
  language: string
  onChange: (value: SetupAnswer) => void
  value: string
}) {
  const choices = field.choices.map((choice) => ({
    label: setupChoiceText(document, language, { fieldId: field.id, value: choice.value }),
    value: choice.value,
  }))
  return (
    <Select
      items={choices}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(nextValue)
      }}
      value={value}
    >
      <SelectTrigger
        aria-describedby={describedBy}
        aria-label={label}
        className="w-full"
        id={field.id}
      >
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
  )
}

function BooleanChoice({
  checked,
  description,
  label,
  onChange,
  recommended,
}: {
  checked: boolean
  description: string | undefined
  label: string
  onChange: (value: boolean) => void
  recommended: boolean
}) {
  const { t } = useTranslation('projects')
  return (
    <label
      className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${checked ? 'border-primary/60 bg-primary/5' : 'border-border/70 hover:bg-muted/35'}`}
    >
      <input
        aria-label={label}
        checked={checked}
        className="sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border ${checked ? 'border-foreground bg-foreground text-background' : 'border-input bg-background'}`}
      >
        {checked ? <Icon name="confirmed" className="size-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 type-body font-medium">
          {label}
          {recommended ? (
            <Badge variant="secondary">{t('setup.document.recommended')}</Badge>
          ) : null}
        </span>
        {description ? (
          <span className="mt-1 block type-label text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  )
}
