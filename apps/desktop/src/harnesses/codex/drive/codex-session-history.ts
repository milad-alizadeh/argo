import {
  createRolloutInvalidation,
  watchRolloutSignals,
} from '@/harnesses/codex/history/rollout-signal'
import {
  CodexHistoryUnavailableError,
  type HistoryTransport,
  requestStoredHistory,
} from '@/harnesses/codex/history/vendor-history'
import { createWatchedCodexSessions } from '@/harnesses/codex/history/watched-session'
import type { AppServerSupervisor } from './app-server-supervisor-machine'
import { waitForChannel } from './codex-session-launch'

export function createCodexSessionHistory(options: {
  supervisor: AppServerSupervisor
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
  transcriptsRoot?: string
  notify: () => void
}) {
  const history: HistoryTransport = {
    request: async (method, params) => {
      await waitForChannel(options.supervisor)
      const channel = options.supervisor.getChannel()
      if (channel === null) throw new CodexHistoryUnavailableError()
      return requestStoredHistory(channel, method, params)
    },
  }
  const watched = createWatchedCodexSessions({
    transport: history,
    knownWorkspaces: options.knownWorkspaces,
  })
  const stopWatch = watchHistory(options.transcriptsRoot, watched, options.notify)
  return { history, watched, stopWatch }
}

function watchHistory(
  transcriptsRoot: string | undefined,
  watched: ReturnType<typeof createWatchedCodexSessions>,
  notify: () => void,
) {
  if (transcriptsRoot === undefined) return () => undefined
  return createRolloutInvalidation({
    subscribe: (onFilename) => watchRolloutSignals(transcriptsRoot, onFilename),
    readThread: async (threadId) => {
      await watched.refreshThread(threadId)
      notify()
    },
    readAll: async () => {
      await watched.refresh()
      notify()
    },
  })
}
