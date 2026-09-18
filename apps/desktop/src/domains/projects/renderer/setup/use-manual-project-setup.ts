import { useCallback, useEffect, useState } from 'react'

type Messages = {
  cancelled: string
  invalid: string
  invalidJson: string
  saved: string
  valid: string
}

export function useManualProjectSetup(projectId: string, messages: Messages) {
  const [source, setSource] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState<'cancel' | 'save' | 'test' | null>(null)
  const saveSource = useCallback(
    async (nextSource: string) => window.argo.saveProjectSetup({ projectId, source: nextSource }),
    [projectId],
  )
  useEffect(() => {
    let active = true
    setMessage(null)
    setSaved(false)
    void window.argo.beginProjectSetup({ projectId }).then((reply) => {
      if (!active) return
      if (reply.type === 'project.setup.editing') {
        setSaved(true)
        setSource(reply.source)
      } else if (reply.type === 'project.error') setMessage(reply.message)
    })
    return () => {
      active = false
    }
  }, [projectId])
  const save = async () => {
    setSaving('save')
    setMessage(null)
    const reply = await saveSource(source)
    if (reply.type === 'project.setup.editing') {
      setSaved(true)
      setMessage(messages.saved)
    } else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(null)
  }
  const testConfiguration = async () => {
    try {
      JSON.parse(source)
    } catch {
      setMessage(messages.invalidJson)
      return
    }
    setSaving('test')
    setMessage(null)
    const reply = await window.argo.validateProjectSetup({ projectId, source })
    if (reply.type === 'project.setup.validated')
      setMessage(reply.valid ? messages.valid : messages.invalid)
    else if (reply.type === 'project.error') setMessage(reply.message)
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
    if (reply.type === 'project.setup.cancelled') setMessage(messages.cancelled)
    else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(null)
  }
  return { cancel, message, saved, save, saving, source, testConfiguration, updateSource }
}
