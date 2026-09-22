import { useTranslation } from 'react-i18next'
import {
  setupChoiceText,
  setupFieldText,
  setupPlanText,
  type SetupDocument,
} from '@/domains/projects/contract/setup'
import { fieldsForSection, SectionIcon, type SetupSectionModel } from './setup-plan-sections'
import type { SetupAnswer } from '../use-setup-answers'

export function SetupPlanSummary({
  answers,
  document,
  language,
  sections,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  document: SetupDocument
  language: string
  sections: readonly SetupSectionModel[]
}) {
  return sections.map((section) => (
    <SetupSummary
      answers={answers}
      document={document}
      key={section.id}
      language={language}
      section={section}
    />
  ))
}

function SetupSummary({
  answers,
  document,
  language,
  section,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  document: SetupDocument
  language: string
  section: SetupSectionModel
}) {
  const text = setupPlanText(document, language, section.id)
  const fields = fieldsForSection(document, section)
  return (
    <div className="flex items-start gap-4 px-4 py-2.5">
      <SectionIcon icon={section.icon} />
      <div className="min-w-0">
        <h4 className="type-body font-medium">{text.label}</h4>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 type-label text-muted-foreground">
          {fields.length > 0
            ? fields.map((field) => (
                <SummaryValue
                  answer={answers[field.id]}
                  document={document}
                  field={field}
                  key={field.id}
                  language={language}
                  mono={section.icon === 'terminal'}
                />
              ))
            : text.description}
        </div>
      </div>
    </div>
  )
}

function SummaryValue({
  answer,
  document,
  field,
  language,
  mono,
}: {
  answer: SetupAnswer | undefined
  document: SetupDocument
  field: SetupDocument['fields'][number]
  language: string
  mono: boolean
}) {
  const { t } = useTranslation('projects')
  const text = setupFieldText(document, language, field.id)
  if (field.type === 'boolean') {
    return (
      <span>
        {t(answer ? 'setup.document.included' : 'setup.document.notIncluded', {
          label: text.label,
        })}
      </span>
    )
  }
  const value =
    field.type === 'choice' && typeof answer === 'string'
      ? setupChoiceText(document, language, { fieldId: field.id, value: answer })
      : String(answer ?? t('setup.document.notSet'))
  return (
    <span>
      {text.label}{' '}
      {mono ? (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{value}</code>
      ) : (
        <span className="font-medium text-foreground">{value}</span>
      )}
    </span>
  )
}
