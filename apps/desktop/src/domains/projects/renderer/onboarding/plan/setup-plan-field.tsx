import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Checkbox } from '@/platform/renderer/components/ui/checkbox'
import { Input } from '@/platform/renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import { type SetupDocument, setupChoiceText, setupFieldText } from '../model/setup-document'
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
        required={field.required}
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
  required,
  recommended,
}: {
  checked: boolean
  description: string | undefined
  label: string
  onChange: (value: boolean) => void
  required?: boolean
  recommended: boolean
}) {
  const { t } = useTranslation('projects')
  const controlId = useId()
  const titleId = useId()
  const descriptionIdentifier = useId()
  const descriptionId = description ? descriptionIdentifier : undefined
  return (
    <div
      className={`relative flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${checked ? 'border-primary bg-primary/5' : 'border hover:bg-muted/35'}`}
    >
      <label className="absolute inset-0 z-0 cursor-pointer rounded-lg" htmlFor={controlId}>
        <span aria-hidden="true" className="sr-only">
          {label}
        </span>
      </label>
      <Checkbox
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        checked={checked}
        className="relative z-10 mt-0.5"
        id={controlId}
        onCheckedChange={(nextChecked) => onChange(nextChecked === true)}
        required={required}
      />
      <div className="pointer-events-none relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2 type-body font-medium">
          <span id={titleId}>{label}</span>
          {recommended ? (
            <Badge variant="secondary">{t('setup.document.recommended')}</Badge>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 type-label text-muted-foreground" id={descriptionId}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
