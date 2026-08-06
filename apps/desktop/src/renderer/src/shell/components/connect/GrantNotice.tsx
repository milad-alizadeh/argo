import { Button, Text, WarningIcon } from '@/shared/components/ui'

/**
 * Molecule: what the panel says when GitHub has refused the grant.
 *
 * There is no separate connections screen to hunt for (#165): the chip that reports the failure
 * points HERE, and both ways out sit on the same surface. Continuing offline is a real answer,
 * not a dismissal, because everything already fetched stays rendered at full fidelity.
 */
export function GrantNotice({
  onReconnect,
  onContinueOffline,
}: {
  /** Run the device-flow sign-in again. */
  onReconnect: () => void
  /** Leave the panel and keep working on what Argo already has. */
  onContinueOffline: () => void
}): React.JSX.Element {
  return (
    <div
      data-component="GrantNotice"
      className="inset-lip flex items-start gap-inset rounded-lg bg-inset p-inset"
    >
      <WarningIcon role="img" aria-label="Warning" className="icon-sm text-tone-amber" />
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        <Text variant="row-strong" as="h3" className="text-foreground-bright">
          GitHub is not accepting this sign-in
        </Text>
        {/* [what · why · fix]: what happened, why it happened, and the two ways forward. */}
        <Text variant="meta" as="p" className="text-foreground-soft">
          The sign-in expired or was revoked, so your backlog and pull requests have stopped
          updating. Sign in again, or keep working with what Argo already has.
        </Text>
      </div>
      <div className="flex shrink-0 items-center gap-snug">
        <Button variant="ghost" size="sm" onClick={onContinueOffline}>
          Continue offline
        </Button>
        <Button variant="primary" size="sm" onClick={onReconnect}>
          Reconnect
        </Button>
      </div>
    </div>
  )
}
