import type { SetupDocument } from '../../contract/setup/setup-document'
import { setupPlanText } from '../../contract/setup/setup-document-text'
import { SetupPlanField } from './setup-plan-field'
import { fieldsForSection, SectionIcon, type SetupSectionModel } from './setup-plan-sections'
import type { SetupAnswer } from './use-setup-answers'

export function SetupPlanCustomization({
  answers,
  document,
  language,
  sections,
  update,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  document: SetupDocument
  language: string
  sections: readonly SetupSectionModel[]
  update: (id: string, value: SetupAnswer) => void
}) {
  return sections.map((section) => (
    <SetupSection
      answers={answers}
      document={document}
      key={section.id}
      language={language}
      section={section}
      update={update}
    />
  ))
}

function SetupSection({
  answers,
  document,
  language,
  section,
  update,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  document: SetupDocument
  language: string
  section: SetupSectionModel
  update: (id: string, value: SetupAnswer) => void
}) {
  const text = setupPlanText(document, language, section.id)
  return (
    <section className="overflow-hidden rounded-xl border border-border/70">
      <header className="flex items-start gap-4 border-b border-border/70 px-5 py-4">
        <SectionIcon icon={section.icon} />
        <div>
          <h3 className="type-body font-medium">{text.label}</h3>
          {text.description ? (
            <p className="mt-1 type-label text-muted-foreground">{text.description}</p>
          ) : null}
        </div>
      </header>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {fieldsForSection(document, section).map((field) => (
          <SetupPlanField
            document={document}
            field={field}
            key={field.id}
            language={language}
            mono={section.icon === 'terminal'}
            onChange={(value) => update(field.id, value)}
            value={answers[field.id]}
          />
        ))}
      </div>
    </section>
  )
}
