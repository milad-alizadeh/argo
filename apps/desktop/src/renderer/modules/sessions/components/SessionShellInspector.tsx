// One background Shell's live output, in the Terminal the rest of the app reads command output
// through (#1582). The pane states the command's own words and its current state.
import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import type { SessionShellCommand } from '@/core/sessions/models'
import { SHELL_STATE_WORDS, workDuration } from './session-work'

export function SessionShellInspector({
  command,
  output,
  now,
}: {
  command: SessionShellCommand
  // What the recorded output source holds, or null where the Shell recorded none. An empty
  // string is a source that exists and has written nothing yet, which is not the same thing.
  output: string | null
  now?: number
}) {
  const title = command.command ?? command.id
  const duration = workDuration(command.startedAt, command.endedAt, now ?? Date.now())
  return (
    <section aria-label="Background Shell" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 py-3">
        <p className="truncate font-mono type-meta text-foreground">{title}</p>
        <p className="type-meta text-muted-foreground">
          {[SHELL_STATE_WORDS[command.state], duration, command.result]
            .filter((fact) => fact !== null)
            .join(' · ')}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {output === null ? (
          <p className="type-meta text-muted-foreground">This command recorded no output.</p>
        ) : (
          <Terminal output={output} isStreaming={command.state === 'running'}>
            <TerminalHeader>
              <TerminalTitle className="type-meta">{title}</TerminalTitle>
              <TerminalCopyButton />
            </TerminalHeader>
            <TerminalContent className="type-code" />
          </Terminal>
        )}
      </div>
    </section>
  )
}
