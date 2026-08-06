import type { GrantState } from '@shared'
import { Button, WarningIcon } from '@/shared/components/ui'

/**
 * Molecule: the top bar's connection roll-up, silent when nothing is wrong.
 *
 * It carries the ONE failure with a global blast radius and a real action: a grant the provider
 * has refused. That failure escalates past the roll-up (failure policy §2), and the chip is the
 * pointer while the connect panel is the destination — which is why the whole reconnect flow is
 * in-panel and no separate connections screen exists.
 *
 * The chip's other state, `stale` with its age and cause word, is the failure policy's own
 * ticket: staleness is a property of a binding rather than of the account grant, and nothing in
 * the projection carries a binding's age yet. Rendering a `stale` chip from what is here would
 * be a claim about freshness Argo cannot currently make.
 */
export function ConnectionChip({
  grant,
  onReconnect,
}: {
  /** The account-level GitHub grant. Anything but a refusal renders nothing at all. */
  grant: GrantState
  /** Open the connect panel, where both ways out live. */
  onReconnect: () => void
}): React.JSX.Element | null {
  if (grant !== 'needs-reconnect') return null
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onReconnect}
      data-component="ConnectionChip"
      className="text-tone-amber"
    >
      <WarningIcon aria-hidden className="icon-sm" />
      needs reconnect
    </Button>
  )
}
