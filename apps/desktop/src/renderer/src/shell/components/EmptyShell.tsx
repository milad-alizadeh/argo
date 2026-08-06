import { Button, Text } from '@/shared/components/ui'

/**
 * Organism: the stage before any project exists.
 *
 * One honest seam and one way forward. Nothing is registered, so there is no roster, no backlog
 * and no counters to show — and the shell shows none, rather than faking a room. The action hands
 * off to onboarding, which owns the panel itself.
 *
 * It asks for a FOLDER rather than a provider (#165): a folder is all a Project takes, and a seam
 * that named a provider would set the entry price the panel behind it exists to refuse.
 */
export function EmptyShell({
  onConnect,
}: {
  /** Hand off to onboarding, which is where a Project is actually created. */
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div
      data-component="EmptyShell"
      className="flex flex-1 flex-col items-center justify-center gap-region px-region text-center"
    >
      <Text as="p" variant="title" className="text-foreground-soft">
        Point Argo at a folder to begin.
      </Text>
      {/* Not `Add a project`: the strip's own `+` already carries that label, and two controls
          answering to one name is a control nobody can address. */}
      <Button variant="primary" onClick={onConnect}>
        Add your first project
      </Button>
    </div>
  )
}
