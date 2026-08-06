import { CLIS, type Cli, isCli } from '@shared'
import { Text, ToggleGroup, ToggleGroupItem } from '@/shared/components/ui'

/** Each CLI under its own name, because a renamed program is not the one the user installed. */
const CLI_LABELS: Record<Cli, string> = { claude: 'Claude Code', codex: 'Codex' }

/**
 * Molecule: which agent CLI this project spawns.
 *
 * The one thing Project Settings holds that onboarding does not (#186). It is per project
 * because nobody runs two editors at once, and it lives here rather than on spawn so that ⌘N
 * stays zero-config and asks nothing.
 */
export function AgentPicker({
  cli,
  onChoose,
}: {
  /** The CLI this project currently spawns. */
  cli: Cli
  /** Choose a different one. Takes effect on the next ⌘N; running sessions keep their own. */
  onChoose: (cli: Cli) => void
}): React.JSX.Element {
  return (
    <div
      data-component="AgentPicker"
      className="inset-lip flex items-center gap-inset rounded-lg bg-inset p-inset"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        <Text variant="row-strong" as="h3" className="text-foreground-bright">
          Agent
        </Text>
        <Text variant="meta" as="p" className="text-foreground-soft">
          The tool a new session starts here. Sessions already running keep the one they started
          with.
        </Text>
      </div>
      <ToggleGroup
        type="single"
        value={cli}
        aria-label="Agent"
        // Radix reports `''` when the pressed item is toggled off. A project always runs
        // something, so deselection is ignored rather than written as "no agent".
        onValueChange={(next) => {
          if (isCli(next)) onChoose(next)
        }}
      >
        {CLIS.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {CLI_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
