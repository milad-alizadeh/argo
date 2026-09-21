import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { composerSend } from '@/domains/sessions/renderer/composer/composer-send'
import { useSessionCreationStore } from '@/domains/sessions/renderer/session-creation'

test('a started Session removes only the submitted attachment paths from its rekeyed composer', async () => {
  useSessionCreationStore.setState({ pending: null })
  const rekeyed: Array<{ from: string; to: string }> = []
  const removed: Array<{ sessionId: string; paths: string[] }> = []
  const send = composerSend({
    harness: 'codex',
    cockpit: {
      status: 'selected',
      project: { id: 'project-1', name: 'Argo', path: '/projects/argo' },
      projects: [],
      message: null,
      code: null,
      busy: false,
    },
    identity: { kind: 'draft', projectId: 'project-1' },
    marker: { begin: () => {}, clear: () => {}, rekey: () => {} },
    navigate: () => undefined as never,
    queryClient: new QueryClient(),
    roster: null,
    send: { mutateAsync: async () => undefined } as never,
    setDraft: () => {},
    removeAttachmentPaths: (sessionId, paths) => removed.push({ sessionId, paths }),
    rekey: (from, to) => rekeyed.push({ from, to }),
    setFailure: () => {},
    start: { mutateAsync: async () => ({ sessionId: 'session-new' }) } as never,
    watchTurn: () => {},
  })

  expect(await send('Read this.', null, [{ path: '/projects/argo/notes.md', kind: 'file' }])).toBe(
    true,
  )

  expect(rekeyed).toEqual([{ from: 'new:project-1', to: 'session-new' }])
  expect(removed).toEqual([{ sessionId: 'session-new', paths: ['/projects/argo/notes.md'] }])
})
