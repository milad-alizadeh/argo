// One background Shell's live output, in the Terminal the rest of the app reads command output
// through (#1582). The pane states the command's own words and its current state.
import { useTranslation } from 'react-i18next'
import type { SessionShellCommand } from '@/domains/sessions/contract/model'
import { InspectorTerminal } from './inspector-terminal'

export function SessionShellInspector({
  command,
  output,
}: {
  command: SessionShellCommand
  // An empty string is a declared source that has not written anything yet.
  output: string
  now?: number
}) {
  const { t } = useTranslation('sessions')
  return (
    <section aria-label={t('rail.shellInspector')} className="flex min-h-0 flex-1 flex-col">
      <InspectorTerminal output={output} streaming={command.state === 'running'} />
    </section>
  )
}
