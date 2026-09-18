import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import { Checkbox } from '@/platform/renderer/components/ui/checkbox'
import { Input } from '@/platform/renderer/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/platform/renderer/components/ui/native-select'
import type { SetupDocument } from '../../contract/setup-document'
import {
  setupChoiceText,
  setupFieldText,
  setupLocale,
  setupPlanText,
} from '../../contract/setup-document-text'
import { type SetupAnswer, useSetupAnswers } from './use-setup-answers'

export function SetupDocumentForm({
  document,
  configurationSource,
  language,
  onAnswersChange,
}: {
  document: SetupDocument
  configurationSource: string
  language: string
  onAnswersChange?: (answers: Readonly<Record<string, SetupAnswer>>) => void
}) {
  const { t } = useTranslation('projects')
  const [customized, setCustomized] = useState(false)
  const { answers, update } = useSetupAnswers(document, configurationSource, onAnswersChange)
  const locale = setupLocale(document, language)
  return (
    <section aria-label={locale.title} className="flex min-w-0 flex-col gap-6">
      <header>
        <h2 className="type-heading font-medium text-foreground">{locale.title}</h2>
        <p className="mt-1 type-body text-muted-foreground">{locale.description}</p>
        {document.progress ? (
          <p className="mt-2 type-meta text-muted-foreground">
            {t('setup.document.progress', { ...document.progress, count: document.progress.total })}
          </p>
        ) : null}
      </header>
      <ol className="flex flex-col gap-3" aria-label={t('setup.document.plan')}>
        {document.plan.map((item) => {
          const text = setupPlanText(document, language, item.id)
          return (
            <li className="rounded-lg border bg-muted/20 px-3 py-2" key={item.id}>
              <p className="type-body font-medium text-foreground">{text.label}</p>
              {text.description ? (
                <p className="mt-0.5 type-meta text-muted-foreground">{text.description}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
      {customized ? (
        <fieldset className="flex flex-col gap-5">
          <legend className="sr-only">{t('setup.document.customization')}</legend>
          {document.fields.map((field) => {
            const text = setupFieldText(document, language, field.id)
            return (
              <div className="flex min-w-0 flex-col gap-1.5" key={field.id}>
                <label className="type-body font-medium text-foreground" htmlFor={field.id}>
                  {text.label}
                  {field.required ? <span aria-hidden="true"> *</span> : null}
                </label>
                {text.description ? (
                  <span className="type-meta text-muted-foreground" id={`${field.id}-description`}>
                    {text.description}
                  </span>
                ) : null}
                <FieldInput
                  describedBy={text.description ? `${field.id}-description` : undefined}
                  field={field}
                  id={field.id}
                  label={text.label}
                  language={language}
                  document={document}
                  value={answers[field.id]}
                  onChange={(value) => update(field.id, value)}
                />
              </div>
            )
          })}
        </fieldset>
      ) : (
        <Button
          className="self-start"
          onClick={() => setCustomized(true)}
          type="button"
          variant="outline"
        >
          {t('setup.document.customize')}
        </Button>
      )}
    </section>
  )
}

function FieldInput({
  field,
  describedBy,
  document,
  id,
  label,
  language,
  onChange,
  value,
}: {
  field: SetupDocument['fields'][number]
  describedBy: string | undefined
  document: SetupDocument
  id: string
  label: string
  language: string
  onChange: (value: SetupAnswer) => void
  value: SetupAnswer | undefined
}) {
  switch (field.type) {
    case 'text':
      return (
        <Input
          aria-describedby={describedBy}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={String(value ?? '')}
        />
      )
    case 'choice': {
      return (
        <NativeSelect
          aria-describedby={describedBy}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={String(value ?? '')}
        >
          {field.choices.map((choice) => (
            <NativeSelectOption key={choice.value} value={choice.value}>
              {setupChoiceText(document, language, { fieldId: field.id, value: choice.value })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )
    }
    case 'boolean':
      return (
        <Checkbox
          aria-label={label}
          aria-describedby={describedBy}
          checked={Boolean(value)}
          id={id}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
      )
  }
}
