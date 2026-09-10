import { Check, ChevronRight, ShieldQuestion } from 'lucide-react'
import { useId, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert'
import { Button } from '@/renderer/components/ui/button'
import { Textarea } from '@/renderer/components/ui/textarea'

export function FeedQuestion({ readOnly = false }: { readOnly?: boolean }) {
  const titleId = useId()
  const [selection, setSelection] = useState('header')
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const options = [
    { id: 'header', title: 'In the header', detail: 'Keep subtitles beside the active Session.' },
    { id: 'footer', title: 'At the bottom', detail: 'Keep voice controls close to the composer.' },
  ]
  if (submitted)
    return (
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <Check className="size-3.5" />
        Answered: {answer || options.find((option) => option.id === selection)?.title}
      </div>
    )
  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-4"
      aria-labelledby={titleId}
      data-component="FeedStructuredQuestion"
    >
      <div>
        <p className="text-control text-muted-foreground">
          {readOnly ? 'Question in external Session' : 'Your input is needed'}
        </p>
        <h3 id={titleId} className="mt-1 text-body font-medium">
          Where should Concierge subtitles appear?
        </h3>
      </div>
      <fieldset className="space-y-2" disabled={readOnly}>
        <legend className="sr-only">Subtitle placement</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 has-checked:bg-muted"
          >
            <input
              type="radio"
              name={titleId}
              value={option.id}
              checked={selection === option.id}
              onChange={() => setSelection(option.id)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block text-body">{option.title}</span>
              <span className="block text-control text-muted-foreground">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {readOnly ? (
        <p className="text-control text-muted-foreground">
          Reply in the CLI. This Session is read-only.
        </p>
      ) : (
        <>
          <Textarea
            aria-label="Write another answer"
            placeholder="Or write another answer…"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="min-h-16 text-body"
          />
          <div className="flex justify-end">
            <Button className="text-control" onClick={() => setSubmitted(true)}>
              Send answer
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

export function FeedPermission() {
  const [decision, setDecision] = useState<'pending' | 'allowed' | 'denied'>('pending')
  if (decision !== 'pending')
    return (
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <ShieldQuestion className="size-3.5" />
        {decision === 'allowed' ? 'Allowed this command once' : 'Denied this command'}
      </div>
    )
  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-4"
      aria-labelledby="feed-permission-title"
      data-component="FeedPermission"
    >
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-4" />
        <h3 id="feed-permission-title" className="text-body font-medium">
          Allow this command?
        </h3>
      </div>
      <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-control">
        bun install
      </pre>
      <p className="text-control text-muted-foreground">
        The command will install this Project’s dependencies and may access the network.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="text-control" onClick={() => setDecision('denied')}>
          Deny
        </Button>
        <Button className="text-control" onClick={() => setDecision('allowed')}>
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
        <ChevronRight className="size-3.5 group-open:rotate-90" />2 records could not be read
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
      <ShieldQuestion />
      <AlertTitle className="text-control">Permission expired</AlertTitle>
      <AlertDescription className="text-control">
        The command was denied because no answer arrived.
      </AlertDescription>
    </Alert>
  )
}
