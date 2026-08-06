import { Button, CheckCircleIcon, CircleIcon, Text } from '@/shared/components/ui'
import type { ConnectRowView } from '../../connect/connectPanelModel'

/**
 * Molecule: one of the connect panel's three rows.
 *
 * Every row states its plain benefit, never the honesty tier it lights up (#165): an earlier
 * draft showed a Direct/Derived/Convention ladder and it was cut. The rows are independent, so
 * a row is never disabled by another row's state and its mark says only whether IT is done.
 */
export function ConnectRow({
  row,
  onAct,
}: {
  /** The derived row: its title, benefit copy, current value and the one act it offers. */
  row: ConnectRowView
  /** Run this row's act. Not called for a row whose `action` is `null`. */
  onAct: () => void
}): React.JSX.Element {
  const Mark = row.done ? CheckCircleIcon : CircleIcon
  return (
    <div
      data-component="ConnectRow"
      className="inset-lip flex items-start gap-inset rounded-lg bg-inset p-inset"
    >
      <Mark
        role="img"
        aria-label={row.done ? 'Done' : 'Not set'}
        className={row.done ? 'icon-sm text-tone-run' : 'icon-sm text-foreground-faint'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        <Text variant="row-strong" as="h3" className="text-foreground-bright">
          {row.title}
        </Text>
        <Text variant="meta" as="p" className="text-foreground-soft">
          {row.benefit}
        </Text>
        {row.value !== null && (
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-faint">
            {row.value}
          </Text>
        )}
      </div>
      {row.action !== null && (
        <Button variant="ghost" size="sm" onClick={onAct}>
          {row.action}
        </Button>
      )}
    </div>
  )
}
