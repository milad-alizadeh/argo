// One background Shell's live output, in the Terminal the rest of the app reads command output
// through (#1582). The pane states the command's own words and its current state.
import { useTranslation } from 'react-i18next'
import type { SessionShellCommand } from '@/domains/sessions/contract/models'
import { InspectorTerminal } from '@/domains/sessions/renderer/components/inspector/inspector-terminal'

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
  const { t } = useTranslation('sessions')
  return (
    <section aria-label={t('rail.shellInspector')} className="flex min-h-0 flex-1 flex-col">
      {output === null ? (
        <p className="px-4 type-meta text-muted-foreground">{t('rail.shellNoOutput')}</p>
      ) : (
        <InspectorTerminal output={output} streaming={command.state === 'running'} />
      )}
    </section>
  )
}
