import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react'

type Messages = {
  invalid: string
  invalidJson: string
  saved: string
  valid: string
}

export type ManualSetupMessage = {
  tone: 'error' | 'success'
  text: string
}

function useInitialSetup(
  projectId: string,
  setters: {
    setSource: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<ManualSetupMessage | null>>
    setSaved: Dispatch<SetStateAction<boolean>>
  },
) {
  const { setMessage, setSaved, setSource } = setters
  useEffect(() => {
    let active = true
    setMessage(null)
    setSaved(false)
    void window.argo.beginProjectSetup({ projectId }).then((reply) => {
      if (!active) return
      if (reply.type === 'project.setup.editing') {
        setSaved(true)
        setSource(reply.source)
      } else if (reply.type === 'project.error') setMessage({ tone: 'error', text: reply.message })
    })
    return () => {
      active = false
    }
  }, [projectId, setMessage, setSaved, setSource])
}

export function useManualProjectSetup(projectId: string, messages: Messages) {
  const [source, setSource] = useState('')
  const [message, setMessage] = useState<ManualSetupMessage | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState<'cancel' | 'save' | 'test' | null>(null)
  const saveSource = useCallback(
    async (nextSource: string) => window.argo.saveProjectSetup({ projectId, source: nextSource }),
    [projectId],
  )
  useInitialSetup(projectId, { setSource, setMessage, setSaved })
  const save = async () => {
    setSaving('save')
    setMessage(null)
    const reply = await saveSource(source)
    if (reply.type === 'project.setup.editing') {
      setSaved(true)
      setMessage({ tone: 'success', text: messages.saved })
    } else if (reply.type === 'project.error') setMessage({ tone: 'error', text: reply.message })
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
  return { cancel, message, saved, save, saving, source, testConfiguration, updateSource }
}
