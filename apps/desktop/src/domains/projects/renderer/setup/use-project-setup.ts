import { useCallback, useEffect, useRef, useState } from 'react'
import type { SetupDocument } from '../../contract/setup-document'
import {
  type ProjectSetupMessage,
  type SetSetup,
  type SetupMessages,
  setupErrorMessage,
  useSetupActions,
} from './project-setup-actions'

export type { ProjectSetupMessage } from './project-setup-actions'

export function useProjectSetup(projectId: string, messages: SetupMessages) {
  const setup = useSetupDocument(projectId, messages)
  const actions = useSetupActions({
    messages,
    projectId,
    setMessage: setup.setMessage,
    setSetup: setup.setSetup,
    source: setup.source,
  })
  return {
    ...actions,
    document: setup.document,
    loading: setup.loading,
    message: setup.message,
    retry: setup.load,
    source: setup.source,
    updateSource: setup.updateSource,
  }
}

function useSetupDocument(projectId: string, messages: SetupMessages) {
  const [source, setSource] = useState('')
  const [document, setDocument] = useState<SetupDocument | null>(null)
  const [message, setMessage] = useState<ProjectSetupMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)
  const load = useCallback(async () => {
    const requestRevision = ++revision.current
    setDocument(null)
    setLoading(true)
    setMessage(null)
    const reply = await window.argo.beginProjectSetup({ projectId })
    if (revision.current !== requestRevision) return
    if (reply.type === 'project.setup.editing') {
      setSource(reply.source)
      setDocument(reply.document)
    } else if (reply.type === 'project.error') {
      setMessage({ tone: 'error', text: setupErrorMessage(reply, messages) })
    }
    setLoading(false)
  }, [messages, projectId])
  useEffect(() => {
    void load()
    return () => {
      revision.current += 1
    }
  }, [load])
  const setSetup: SetSetup = ({ document: nextDocument, source: nextSource }) => {
    setDocument(nextDocument)
    setSource(nextSource)
  }
  return {
    document,
    load,
    loading,
    message,
    setMessage,
    setSetup,
    source,
    updateSource: (nextSource: string) => {
      setMessage(null)
      setSource(nextSource)
    },
  }
}
