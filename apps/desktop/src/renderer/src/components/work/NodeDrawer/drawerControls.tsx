import { Button, GearIcon, Text, useDisclosure } from '@/components/ui'

/** A drawer's small key/value line — the study's `.growrow`. */
export function GrowRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex items-center gap-gap">{children}</div>
}

/** A gate's two-step confirm: arm on the first click, confirm on the second, cancel to back
 * out. Local UI state — the click that actually ships is a later ticket's dispatch. */
export function GateAction({
  label,
  confirmLabel,
  hint,
}: {
  label: string
  confirmLabel: string
  hint: React.ReactNode
}): React.JSX.Element {
  const [armed, arm] = useDisclosure({})
  return (
    <div className="flex items-center gap-gap">
      <Button variant="primary" onClick={arm}>
        {armed ? confirmLabel : label}
      </Button>
      {armed ? (
        <Button variant="ghost" size="sm" onClick={arm}>
          cancel
        </Button>
      ) : (
        <Text variant="meta" className="text-foreground-faint">
          {hint}
        </Text>
      )}
    </div>
  )
}

/** A delegated gate's standing order — narrated, never a button, with the one revoke it
 * carries (R6). */
export function DelegatedRow({ note }: { note: React.ReactNode }): React.JSX.Element {
  return (
    <GrowRow>
      <GearIcon aria-hidden className="text-foreground-faint" />
      <Text variant="row" className="text-foreground-faint">
        {note}
      </Text>
      <Button variant="ghost" size="sm" title="revoke the standing order — the gate returns to ask">
        revoke
      </Button>
    </GrowRow>
  )
}
