import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { Icon } from '@/platform/renderer/components/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/platform/renderer/components/ui/questionnaire'
import { ProjectSetupEditor } from './project-setup-editor'

type InputScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function InputScreen({ command, snapshot }: InputScreenProps) {
  switch (snapshot.screen) {
    case 'questions':
      return <Questions command={command} snapshot={snapshot} />
    case 'manual':
      return <Manual command={command} snapshot={snapshot} />
    default:
      return null
  }
}

function Questions({ command, snapshot }: InputScreenProps) {
  const { t } = useTranslation('projects')
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const completed = snapshot.questions.map(({ id }) => ({
    id,
    selections: selections[id] ?? [],
    custom: customAnswers[id] ?? '',
  }))
  const submitAnswers = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void command({ type: 'answer-questions', answers: completed })
  }
  const items = questionItems(snapshot)
  return (
    <Questionnaire
      className="mt-7 rounded-xl border bg-card p-5"
      items={items}
      onSubmit={submitAnswers}
      shortcuts="letters"
    >
      <QuestionnaireProgress
        aria-label={t('setup.actor.questions.progressLabel')}
        render={(props, { current, total }) => (
          <div {...props}>{t('setup.actor.questions.progress', { current, total })}</div>
        )}
      />
      {snapshot.questions.map((question) => (
        <QuestionnaireItem key={question.id} multiple name={question.id} required>
          <QuestionnaireTitle>{question.prompt}</QuestionnaireTitle>
          {question.context ? (
            <QuestionnaireDescription>{question.context}</QuestionnaireDescription>
          ) : null}
          <QuestionnaireChoices>
            {question.suggestions.map((suggestion) => (
              <QuestionnaireChoice
                checked={(selections[question.id] ?? []).includes(suggestion)}
                key={suggestion}
                onChange={() =>
                  setSelections((current) => ({
                    ...current,
                    [question.id]: toggled(current[question.id] ?? [], suggestion),
                  }))
                }
                value={suggestion}
              >
                <span className="flex items-center justify-between gap-3 font-medium">
                  {suggestion}
                  {suggestion === question.recommended ? (
                    <Badge size="compact" variant="secondary">
                      {t('setup.actor.questions.recommended')}
                    </Badge>
                  ) : null}
                </span>
              </QuestionnaireChoice>
            ))}
            <QuestionnaireInput
              aria-label={t('setup.actor.questions.otherAnswer')}
              onChange={(event) =>
                setCustomAnswers((current) => ({
                  ...current,
                  [question.id]: event.target.value,
                }))
              }
              placeholder={t('setup.actor.questions.otherAnswerPlaceholder')}
              value={customAnswers[question.id] ?? ''}
            />
          </QuestionnaireChoices>
          <QuestionnaireError>{t('setup.actor.questions.chooseAnswer')}</QuestionnaireError>
        </QuestionnaireItem>
      ))}
      <QuestionActions />
    </Questionnaire>
  )
}

function questionItems(snapshot: ProjectSetupSnapshot) {
  return snapshot.questions.map(({ id, suggestions }) => ({
    name: id,
    required: true,
    choices: suggestions.map((value) => ({ value })),
  }))
}

function QuestionActions() {
  const { t } = useTranslation('projects')
  return (
    <QuestionnaireActions>
      <QuestionnairePrevious>{t('setup.actor.questions.previous')}</QuestionnairePrevious>
      <QuestionnaireNext>{t('setup.actor.questions.next')}</QuestionnaireNext>
      <QuestionnaireSubmit>{t('setup.actor.questions.continue')}</QuestionnaireSubmit>
    </QuestionnaireActions>
  )
}

function toggled(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value]
}

function Manual({ command, snapshot }: InputScreenProps) {
  const { t } = useTranslation('projects')
  const [source, setSource] = useState(snapshot.manualSource)
  useEffect(() => setSource(snapshot.manualSource), [snapshot.manualSource])
  return (
    <>
      <section className="mt-7 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
            <Icon name="config-file" size="control" />
          </span>
          <span className="min-w-0">
            <span className="block type-body font-semibold">
              {t('setup.actor.manual.cardTitle')}
            </span>
            <small className="mt-1 block type-control leading-snug text-muted-foreground">
              {t('setup.actor.manual.cardDescription')}
            </small>
          </span>
        </div>
        <div className="border-t p-4">
          <ProjectSetupEditor onChange={setSource} source={source} />
        </div>
      </section>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button onClick={() => void command({ type: 'back' })} variant="outline">
          {t('setup.document.back')}
        </Button>
        <Button onClick={() => void command({ type: 'save-manual', source })}>
          {t('setup.actor.manual.action')}
        </Button>
      </div>
    </>
  )
}
