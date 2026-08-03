import { Button, Text } from '@/shared/components/ui'

/**
 * Organism: the stage before anything is connected.
 *
 * One honest seam and one way forward. Nothing is connected, so there is no roster, no backlog
 * and no counters to show — and the shell shows none, rather than faking a room. The action hands
 * off to onboarding, which owns the panel itself.
 */
export function EmptyShell({
  onConnect,
}: {
  /** Hand off to onboarding, where a provider is actually connected. */
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div
      data-component="EmptyShell"
      className="flex flex-1 flex-col items-center justify-center gap-region px-region text-center"
    >
      <Text as="p" variant="title" className="text-foreground-soft">
        Connect a provider to begin.
      </Text>
      <Button variant="primary" onClick={onConnect}>
        Connect a provider
      </Button>
    </div>
  )
}
