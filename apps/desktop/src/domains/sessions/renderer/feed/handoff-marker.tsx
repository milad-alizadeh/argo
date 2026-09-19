import { Loader } from '../../../../platform/renderer/components/loader'

export function HandoffMarker() {
  return (
    <article className="feed-row feed-row--marker grid gap-2 type-body" role="status">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Loader aria-hidden={true} />
        <span>Handing off to a new session…</span>
      </div>
    </article>
  )
}

export function HandoffCompletedMarker({
  sessionId,
  onOpenSession,
}: {
  sessionId: string
  onOpenSession: (sessionId: string) => void
}) {
  return (
    <article className="feed-row feed-row--marker grid gap-2 type-body">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Handed off to a new session.</span>
        <button
          className="text-foreground underline underline-offset-2"
          onClick={() => onOpenSession(sessionId)}
          type="button"
        >
          Open Session
        </button>
      </div>
    </article>
  )
}
