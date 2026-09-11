import { Check, ChevronDown, ChevronRight, ShieldQuestion } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert'
import { Button } from '@/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
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

const PERMISSION_COMMAND =
  'bun install --frozen-lockfile && bun run typecheck && bun run test --filter composer'
type PermissionDecision = 'pending' | 'allowed' | 'all' | 'denied'
const PERMISSION_DECISION_LABELS: Record<Exclude<PermissionDecision, 'pending'>, string> = {
  allowed: 'Allowed this command',
  all: 'Allowed all commands',
  denied: 'Denied this command',
}

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
      <p className="text-(length:--text-control) text-muted-foreground">
        {readOnly ? 'Question in external Session' : 'Your input is needed'}
      </p>
      <QuestionnaireItem name={CONCIERGE_QUESTION.name} required={CONCIERGE_QUESTION.required}>
        <QuestionnaireTitle className="text-(length:--text-body)">
          Where should Concierge subtitles appear?
        </QuestionnaireTitle>
        <QuestionnaireDescription className="text-(length:--text-control)">
          {readOnly
            ? 'Reply in the CLI. This Session is read-only.'
            : 'Choose a placement or write another answer.'}
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          {CONCIERGE_QUESTION.choices.map((choice) => (
            <QuestionnaireChoice
              key={choice.value}
              value={choice.value}
              className="min-h-10 py-2 text-(length:--text-body)"
              disabled={readOnly}
              checked={selection === choice.value}
              onChange={() => setSelection(choice.value)}
            >
              <span className="font-medium">{choice.label}</span>
              <QuestionnaireChoiceDescription className="text-(length:--text-control)">
                {choice.detail}
              </QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          ))}
          <QuestionnaireInput
            aria-label="Write another answer"
            placeholder="Or write another answer…"
            value={answer}
            disabled={readOnly}
            className="min-h-10 text-(length:--text-body) md:text-(length:--text-body)"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </QuestionnaireChoices>
      </QuestionnaireItem>
      {readOnly ? null : (
        <div className="flex justify-end">
          <QuestionnaireSubmit className="bg-foreground text-(length:--text-control) text-background hover:bg-foreground/80">
            Send answer
          </QuestionnaireSubmit>
        </div>
      )}
    </Questionnaire>
  )
}

export function FeedPermission() {
  const [decision, setDecision] = useState<PermissionDecision>('pending')
  if (decision !== 'pending')
    return (
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <ShieldQuestion className="!size-(--size-icon-inline)" />
        {PERMISSION_DECISION_LABELS[decision]}
      </div>
    )
  return (
    <section
      className="space-y-2 rounded-lg border bg-card/90 px-3 py-2.5 shadow-lg shadow-foreground/5 backdrop-blur-sm"
      aria-labelledby="feed-permission-title"
      data-component="FeedPermission"
    >
      <div className="flex items-start gap-2">
        <ShieldQuestion className="mt-0.5 !size-(--size-icon-control)" />
        <div className="min-w-0 flex-1">
          <h3 id="feed-permission-title" className="text-(length:--text-body) font-medium">
            Allow this command?
          </h3>
          <p className="text-(length:--text-control) text-muted-foreground">
            Installs Project dependencies, runs local checks, and may access the network.
          </p>
        </div>
      </div>
      <pre className="max-h-20 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-(length:--text-control) leading-relaxed">
        <code>{PERMISSION_COMMAND}</code>
      </pre>
      <div className="flex justify-end gap-1">
        <Button variant="outline" className="text-control" onClick={() => setDecision('denied')}>
          Deny
        </Button>
        <div className="inline-flex overflow-hidden rounded-lg">
          <Button
            className="rounded-r-none bg-foreground text-(length:--text-control) text-background hover:bg-foreground/80"
            onClick={() => setDecision('allowed')}
          >
            Allow
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  aria-label="More allow options"
                  className="rounded-l-none border-l border-background/20 bg-foreground text-background hover:bg-foreground/80"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-36">
              <DropdownMenuItem className="text-control" onClick={() => setDecision('all')}>
                Allow all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
