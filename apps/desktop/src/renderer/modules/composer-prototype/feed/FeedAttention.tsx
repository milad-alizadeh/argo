import { Check, ChevronDown, FileWarning, ShieldQuestion, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
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
import { FEED_CARD_RADIUS_CLASS } from '../../sessions/feed/content/feedSurface'

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

export function FeedQuestion({ readOnly = false }: { readOnly?: boolean }) {
  const [selection, setSelection] = useState('roster')
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  if (submitted)
    return (
      <div className="flex items-center gap-2 type-meta text-muted-foreground">
        <Check className="!size-(--size-icon-inline)" />
        Answered:{' '}
        {answer || CONCIERGE_QUESTION.choices.find((choice) => choice.value === selection)?.label}
      </div>
    )
  return (
    <Questionnaire
      items={[CONCIERGE_QUESTION]}
      className={`${FEED_CARD_RADIUS_CLASS} border bg-card p-4`}
      data-component="FeedStructuredQuestion"
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
      }}
    >
      <p className="type-meta text-muted-foreground">
        {readOnly ? 'Question in external Session' : 'Your input is needed'}
      </p>
      <QuestionnaireItem name={CONCIERGE_QUESTION.name} required={CONCIERGE_QUESTION.required}>
        <QuestionnaireTitle className="type-heading">
          Where should Concierge subtitles appear?
        </QuestionnaireTitle>
        <QuestionnaireDescription className="type-body">
          {readOnly
            ? 'Reply in the CLI. This Session is read-only.'
            : 'Choose a placement or write another answer.'}
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          {CONCIERGE_QUESTION.choices.map((choice) => (
            <QuestionnaireChoice
              key={choice.value}
              value={choice.value}
              className="min-h-10 py-2 type-body"
              disabled={readOnly}
              checked={selection === choice.value}
              onChange={() => setSelection(choice.value)}
            >
              <span className="type-heading font-medium">{choice.label}</span>
              <QuestionnaireChoiceDescription className="type-body">
                {choice.detail}
              </QuestionnaireChoiceDescription>
            </QuestionnaireChoice>
          ))}
          <QuestionnaireInput
            aria-label="Write another answer"
            placeholder="Or write another answer…"
            value={answer}
            disabled={readOnly}
            className="min-h-10 type-body"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </QuestionnaireChoices>
      </QuestionnaireItem>
      {readOnly ? null : (
        <div className="flex justify-end">
          <QuestionnaireSubmit className="bg-foreground type-label text-background hover:bg-foreground/80">
            Send answer
          </QuestionnaireSubmit>
        </div>
      )}
    </Questionnaire>
  )
}

export function FeedPermission() {
  const [resolved, setResolved] = useState(false)
  if (resolved) return null
  return (
    <section
      className={`space-y-2 border bg-card px-3 py-2.5 shadow-lg shadow-foreground/5 backdrop-blur-sm ${FEED_CARD_RADIUS_CLASS}`}
      aria-labelledby="feed-permission-title"
      data-component="FeedPermission"
    >
      <div className="flex items-start gap-2">
        <ShieldQuestion className="mt-0.5 !size-(--size-icon-control)" />
        <div className="min-w-0 flex-1">
          <h3 id="feed-permission-title" className="type-heading font-medium">
            Allow this command?
          </h3>
          <p className="type-meta text-muted-foreground">
            Installs Project dependencies, runs local checks, and may access the network.
          </p>
        </div>
      </div>
      <pre className="max-h-20 overflow-auto rounded-md bg-muted px-3 py-2 font-mono type-code">
        <code>{PERMISSION_COMMAND}</code>
      </pre>
      <div className="flex justify-end gap-1">
        <Button variant="outline" className="type-label" onClick={() => setResolved(true)}>
          Deny
        </Button>
        <div className="inline-flex overflow-hidden rounded-lg">
          <Button
            variant="default"
            className="rounded-r-none border-r-0 type-label"
            onClick={() => setResolved(true)}
          >
            Allow
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="default"
                  size="icon"
                  aria-label="More allow options"
                  className="rounded-l-none border-l border-primary-foreground/20"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-36">
              <DropdownMenuItem className="type-label" onClick={() => setResolved(true)}>
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
    <CollapsibleText
      icon={FileWarning}
      title={
        <>
          2 records could not be read <span className="ml-2">View source</span>
        </>
      }
      content={
        <pre className="max-h-40 overflow-auto font-mono type-code">
          {
            '{"type":"assistant","message":\n[record ends unexpectedly]\n\nThe next readable record continues below.'
          }
        </pre>
      }
    />
  )
}

export function FeedExpiredPermission() {
  return (
    <div role="alert" className="flex items-center gap-2 py-1 type-body text-destructive">
      <ShieldX className="!size-(--size-icon-inline) shrink-0" />
      <p>
        <span className="font-medium">Permission expired</span>
        <span className="text-destructive"> The command was denied because no answer arrived.</span>
      </p>
    </div>
  )
}
