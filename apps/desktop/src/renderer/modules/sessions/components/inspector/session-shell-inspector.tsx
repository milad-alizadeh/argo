// One background Shell's live output, in the Terminal the rest of the app reads command output
// through (#1582). The pane states the command's own words and its current state.
import type { SessionShellCommand } from '@/core/sessions/models'
import { InspectorTerminal } from './inspector-terminal'

export function SessionShellInspector({
  command,
  output,
}: {
  command: SessionShellCommand
  // What the recorded output source holds, or null where the Shell recorded none. An empty
  // string is a source that exists and has written nothing yet, which is not the same thing.
  output: string | null
  now?: number
}) {
  return (
    <section aria-label="Background Shell" className="flex min-h-0 flex-1 flex-col">
      {output === null ? (
        <p className="px-4 type-meta text-muted-foreground">This command recorded no output.</p>
      ) : (
        <InspectorTerminal output={output} streaming={command.state === 'running'} />
      )}
    </section>
  )
}
