import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'
import { Notice } from '@/platform/renderer/components/design-system/notice'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/platform/renderer/components/ui/questionnaire'
import type { SessionFeedRow } from '../../types'
import { FEED_CARD_RADIUS_CLASS } from '../content/feed-surface'

const FEED_QUESTIONNAIRE_SLOTS = {
  root: `${FEED_CARD_RADIUS_CLASS} border bg-card p-4`,
  title: 'font-heading type-heading',
  description: 'type-body',
  choice: 'min-h-10 py-2 type-body',
  choiceLabel: 'type-heading',
  input: 'min-h-10 type-body',
  submit: 'bg-foreground text-background hover:bg-foreground/80',
}

type AskRow = Extract<SessionFeedRow, { shape: 'ask' }>

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

// A free-text answer overrides any option ticked for the same question — the row's own "Or write
// another answer" field and its choices name the same one answer, never both at once.
function answerFor(question: Question, selected: string[], text: string): QuestionAnswer {
  if (text.trim()) return { kind: 'text', index: question.options.length + 1, text: text.trim() }
  const indices = selected
    .map((label) => question.options.findIndex((option) => option.label === label) + 1)
    .filter((index) => index > 0)
    .sort((a, b) => a - b)
  return { kind: 'options', indices }
}

function QuestionField({
  index,
  question,
  selected,
  text,
  disabled,
  onSelect,
  onText,
}: {
  index: number
  question: Question
  selected: string[]
  text: string
  disabled: boolean
  onSelect: (selected: string[]) => void
  onText: (text: string) => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <QuestionnaireItem name={`question-${index}`} multiple={question.multiSelect}>
      {question.header ? (
        <QuestionnaireTitle className={FEED_QUESTIONNAIRE_SLOTS.title}>
          {question.header}
        </QuestionnaireTitle>
      ) : null}
      <QuestionnaireDescription className={FEED_QUESTIONNAIRE_SLOTS.description}>
        {question.question}
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        {question.options.map((option) => (
          <QuestionnaireChoice
            key={option.label}
            value={option.label}
            className={FEED_QUESTIONNAIRE_SLOTS.choice}
            disabled={disabled}
            checked={selected.includes(option.label)}
            onChange={() =>
              onSelect(question.multiSelect ? toggle(selected, option.label) : [option.label])
            }
          >
            <span className={FEED_QUESTIONNAIRE_SLOTS.choiceLabel}>{option.label}</span>
            {option.description === null ? null : (
              <QuestionnaireChoiceDescription className={FEED_QUESTIONNAIRE_SLOTS.description}>
                {option.description}
              </QuestionnaireChoiceDescription>
            )}
          </QuestionnaireChoice>
        ))}
        <QuestionnaireInput
          aria-label={t('question.writeAnother')}
          placeholder={t('question.writeAnotherPlaceholder')}
          value={text}
          disabled={disabled}
          className={FEED_QUESTIONNAIRE_SLOTS.input}
          onChange={(event) => onText(event.target.value)}
        />
      </QuestionnaireChoices>
    </QuestionnaireItem>
  )
}

// Argo holds no channel to a Session it did not spawn, so it cannot write an answer into
// whatever process is actually waiting on this question — a PTY open in another app, most
// often (#2205). The question itself stays readable, with no radio or submit to act on it.
function FeedQuestionLocked({ row }: { row: AskRow }) {
  const { t } = useTranslation('sessions')
  return (
    <div
      className={`${FEED_CARD_RADIUS_CLASS} space-y-3 border bg-card p-4`}
      data-component="FeedQuestion"
    >
      <p className="type-meta text-muted-foreground">{t('question.needed')}</p>
      {row.questions.map((question) => (
        <div key={question.question} className="space-y-1">
          {question.header ? <p className="type-heading">{question.header}</p> : null}
          <p className="type-body">{question.question}</p>
        </div>
      ))}
      <Alert className="border-0 bg-transparent p-0">
        <Icon name="awaiting-permission" />
        <AlertTitle>{t('question.locked.title')}</AlertTitle>
        <AlertDescription>{t('question.locked.description')}</AlertDescription>
      </Alert>
    </div>
  )
}

export function FeedQuestion({
  row,
  answering,
  failure,
  locked,
  onAnswer,
}: {
  row: AskRow
  answering: boolean
  failure: string | null
  locked: boolean
  onAnswer: (questionId: string, answers: QuestionAnswer[]) => void
}) {
  const { t } = useTranslation('sessions')
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [texts, setTexts] = useState<Record<number, string>>({})

  if (row.answer !== null) {
    return (
      <div className="flex items-center gap-2 type-meta text-muted-foreground">
        <Icon name="confirmed" size="control" />
        {row.answer}
      </div>
    )
  }

  if (locked) return <FeedQuestionLocked row={row} />

  if (row.unsupported !== null) {
    return (
      <Alert className={FEED_QUESTIONNAIRE_SLOTS.root} data-component="FeedQuestion">
        <AlertDescription>{row.unsupported}</AlertDescription>
      </Alert>
    )
  }

  const canSubmit = row.questions.every(
    (_question, index) =>
      (texts[index]?.trim() ?? '') !== '' || (selections[index]?.length ?? 0) > 0,
  )

  return (
    <Questionnaire
      className={FEED_QUESTIONNAIRE_SLOTS.root}
      data-component="FeedQuestion"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        const answers = row.questions.map((question, index) =>
          answerFor(question, selections[index] ?? [], texts[index] ?? ''),
        )
        onAnswer(row.id, answers)
      }}
    >
      <p className="type-meta text-muted-foreground">{t('question.needed')}</p>
      {row.questions.map((question, index) => (
        <QuestionField
          key={question.question}
          index={index}
          question={question}
          selected={selections[index] ?? []}
          text={texts[index] ?? ''}
          disabled={answering}
          onSelect={(selected) => setSelections((previous) => ({ ...previous, [index]: selected }))}
          onText={(text) => setTexts((previous) => ({ ...previous, [index]: text }))}
        />
      ))}
      {failure === null ? null : (
        <Notice icon="octagon-alert" tone="danger">
          {failure}
        </Notice>
      )}
      <div className="flex justify-end">
        <QuestionnaireSubmit
          disabled={!canSubmit || answering}
          className={FEED_QUESTIONNAIRE_SLOTS.submit}
        >
          {t('question.send')}
        </QuestionnaireSubmit>
      </div>
    </Questionnaire>
  )
}
