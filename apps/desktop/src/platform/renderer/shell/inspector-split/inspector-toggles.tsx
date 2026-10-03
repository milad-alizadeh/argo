import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'

type InspectorState = 'open' | 'collapsed' | 'expanded'

export function InspectorToggles({
  noun,
  state,
  onToggle,
  onToggleExpanded,
}: {
  noun: string
  state: InspectorState
  onToggle: () => void
  onToggleExpanded: () => void
}) {
  const expanded = state === 'expanded'
  return (
    <>
      {state === 'collapsed' ? (
        <Button
          aria-label={`Open ${noun} inspector`}
          data-inspector-toggle
          className="bg-accent text-accent-foreground hover:bg-accent aria-expanded:bg-accent aria-expanded:text-accent-foreground"
          variant="secondary"
          size="icon-sm"
          onClick={onToggle}
        >
          <Icon className="text-muted-foreground" name="panel-right" />
        </Button>
      ) : (
        <>
          <Button
            aria-label={expanded ? `Restore ${noun} sidebar` : `Expand ${noun} sidebar`}
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpanded}
          >
            {expanded ? (
              <Icon className="text-muted-foreground" name="restore" />
            ) : (
              <Icon className="text-muted-foreground" name="expand" />
            )}
          </Button>
          <Button
            aria-label={`Collapse ${noun} inspector`}
            data-inspector-toggle
            className="bg-accent text-accent-foreground hover:bg-accent aria-expanded:bg-accent aria-expanded:text-accent-foreground"
            variant="secondary"
            size="icon-sm"
            onClick={onToggle}
          >
            <Icon className="text-muted-foreground" name="panel-right" />
          </Button>
        </>
      )}
    </>
  )
}
