import { Check, ChevronRight, ShieldQuestion } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert'
import { Button } from '@/renderer/components/ui/button'
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
} from '@/renderer/components/ui/questionnaire'

const CONCIERGE_QUESTION = {
  name: 'concierge-placement',
  required: true,
  choices: [
    {
      value: 'roster',
      label: 'Below the Session list',
      detail: 'Show the orb and live subtitles together.',
    },
    {
      value: 'floating',
      label: 'Floating companion',
      detail: 'Keep it available when the app is not frontmost.',
    },
  ],
} as const

export function FeedQuestion({ readOnly = false }: { readOnly?: boolean }) {
  const [selection, setSelection] = useState('roster')
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  if (submitted)
    return (
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <Check className="!size-(--size-icon-inline)" />
        Answered:{' '}
        {answer || CONCIERGE_QUESTION.choices.find((choice) => choice.value === selection)?.label}
      </div>
    )
  return (
    <Questionnaire
      items={[CONCIERGE_QUESTION]}
      className="rounded-lg border bg-card p-4"
      data-component="FeedStructuredQuestion"
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
      }}
    >
      <p className="text-control text-muted-foreground">
        {readOnly ? 'Question in external Session' : 'Your input is needed'}
      </p>
      <QuestionnaireItem name={CONCIERGE_QUESTION.name} required={CONCIERGE_QUESTION.required}>
        <QuestionnaireTitle>Where should Concierge subtitles appear?</QuestionnaireTitle>
        <QuestionnaireDescription>
          {readOnly
            ? 'Reply in the CLI. This Session is read-only.'
            : 'Choose a placement or write another answer.'}
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          {CONCIERGE_QUESTION.choices.map((choice) => (
            <QuestionnaireChoice
              key={choice.value}
              value={choice.value}
              disabled={readOnly}
              checked={selection === choice.value}
              onChange={() => setSelection(choice.value)}
            >
              <span className="font-medium">{choice.label}</span>
              <QuestionnaireChoiceDescription>{choice.detail}</QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          ))}
          <QuestionnaireInput
            aria-label="Write another answer"
            placeholder="Or write another answer…"
            value={answer}
            disabled={readOnly}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </QuestionnaireChoices>
      </QuestionnaireItem>
      {readOnly ? null : (
        <div className="flex justify-end">
          <QuestionnaireSubmit className="bg-foreground text-control text-background hover:bg-foreground/80">
            Send answer
          </QuestionnaireSubmit>
        </div>
      )}
    </Questionnaire>
  )
}

export function FeedPermission() {
  const [decision, setDecision] = useState<'pending' | 'allowed' | 'denied'>('pending')
  if (decision !== 'pending')
    return (
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <ShieldQuestion className="!size-(--size-icon-inline)" />
        {decision === 'allowed' ? 'Allowed this command once' : 'Denied this command'}
      </div>
    )
  return (
    <section
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg shadow-foreground/5"
      aria-labelledby="feed-permission-title"
      data-component="FeedPermission"
    >
      <ShieldQuestion className="!size-(--size-icon-control)" />
      <div className="min-w-0 flex-1">
        <h3 id="feed-permission-title" className="text-control font-medium">
          Allow this command?
        </h3>
        <p className="truncate text-[10px] text-muted-foreground">
          Installs Project dependencies and may access the network.
        </p>
      </div>
      <code className="rounded-md bg-muted px-2 py-1 font-mono text-control">bun install</code>
      <div className="flex gap-1">
        <Button variant="outline" className="text-control" onClick={() => setDecision('denied')}>
          Deny
        </Button>
        <Button
          className="bg-foreground text-control text-background hover:bg-foreground/80"
          onClick={() => setDecision('allowed')}
        >
          Allow once
        </Button>
      </div>
    </section>
  )
}

export function FeedUnreadable() {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-control">
        <ChevronRight className="!size-(--size-icon-inline) group-open:rotate-90" />2 records could
        not be read
        <span className="ml-auto text-muted-foreground">View source</span>
      </summary>
      <pre className="max-h-40 overflow-auto border-t p-3 font-mono text-control">
        {
          '{"type":"assistant","message":\n[record ends unexpectedly]\n\nThe next readable record continues below.'
        }
      </pre>
    </details>
  )
}

export function FeedExpiredPermission() {
  return (
    <Alert variant="destructive">
      <ShieldQuestion className="!size-(--size-icon-control)" />
      <AlertTitle className="text-control">Permission expired</AlertTitle>
      <AlertDescription className="text-control">
        The command was denied because no answer arrived.
      </AlertDescription>
    </Alert>
  )
}
