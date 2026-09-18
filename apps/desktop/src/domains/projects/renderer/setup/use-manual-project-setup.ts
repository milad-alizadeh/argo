import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react'
import type { ProjectError, ProjectErrorCode } from '../../contract/contract'
import type { SetupDocument } from '../../contract/setup-document'

type Messages = {
  invalid: string
  invalidJson: string
  invalidSetupDocument: string
  setupNetworkUnavailable: string
  saved: string
  valid: string
}

export type ManualSetupMessage = {
  tone: 'error' | 'success'
  text: string
}

function useInitialSetup(
  projectId: string,
  messages: Messages,
  setters: {
    setSource: Dispatch<SetStateAction<string>>
    setDocument: Dispatch<SetStateAction<SetupDocument | null>>
    setMessage: Dispatch<SetStateAction<ManualSetupMessage | null>>
    setSaved: Dispatch<SetStateAction<boolean>>
  },
) {
  const { setDocument, setMessage, setSaved, setSource } = setters
  useEffect(() => {
    let active = true
    setMessage(null)
    setSaved(false)
    void window.argo.beginProjectSetup({ projectId }).then((reply) => {
      if (!active) return
      if (reply.type === 'project.setup.editing') {
        setSaved(false)
        setSource(reply.source)
        setDocument(reply.document)
      } else if (reply.type === 'project.error') {
        setMessage({ tone: 'error', text: setupErrorMessage(reply, messages) })
      }
    })
    return () => {
      active = false
    }
  }, [messages, projectId, setDocument, setMessage, setSaved, setSource])
}

export function useManualProjectSetup(projectId: string, messages: Messages) {
  const [source, setSource] = useState('')
  const [document, setDocument] = useState<SetupDocument | null>(null)
  const [message, setMessage] = useState<ManualSetupMessage | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState<'cancel' | 'save' | 'test' | null>(null)
  const saveSource = useCallback(
    async (nextSource: string) => window.argo.saveProjectSetup({ projectId, source: nextSource }),
    [projectId],
  )
  useInitialSetup(projectId, messages, { setSource, setDocument, setMessage, setSaved })
  const save = async () => {
    setSaving('save')
    setMessage(null)
    const reply = await saveSource(source)
    if (reply.type === 'project.setup.editing') {
      setSaved(true)
      setMessage({ tone: 'success', text: messages.saved })
    } else if (reply.type === 'project.error') {
      setMessage({ tone: 'error', text: setupErrorMessage(reply, messages) })
    }
    setSaving(null)
  }
  const testConfiguration = async () => {
    try {
      JSON.parse(source)
    } catch {
      setMessage({ tone: 'error', text: messages.invalidJson })
      return
    }
    setSaving('test')
    setMessage(null)
    const reply = await window.argo.validateProjectSetup({ projectId, source })
    if (reply.type === 'project.setup.validated')
      setMessage({
        tone: reply.valid ? 'success' : 'error',
        text: reply.valid ? messages.valid : messages.invalid,
      })
    else if (reply.type === 'project.error') setMessage({ tone: 'error', text: reply.message })
    setSaving(null)
  }
  const updateSource = (nextSource: string) => {
    setSaved(false)
    setSource(nextSource)
  }
  const cancel = async () => {
    setSaving('cancel')
    setMessage(null)
    const reply = await window.argo.cancelProjectSetup({ projectId })
    if (reply.type === 'project.error') setMessage({ tone: 'error', text: reply.message })
    setSaving(null)
  }
  return { cancel, document, message, saved, save, saving, source, testConfiguration, updateSource }
}

const SETUP_ERROR_MESSAGES = {
  'setup-network-unavailable': 'setupNetworkUnavailable',
  'setup-document-invalid': 'invalidSetupDocument',
} as const satisfies Partial<Record<ProjectErrorCode, keyof Messages>>

function setupErrorMessage(error: ProjectError, messages: Messages) {
  const key = SETUP_ERROR_MESSAGES[error.code as keyof typeof SETUP_ERROR_MESSAGES]
  return key ? messages[key] : error.message
}
