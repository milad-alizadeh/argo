import { useEffect, useState } from 'react'

type Messages = { cancelled: string; saved: string; valid: string; invalid: string }

export function useManualProjectSetup(projectId: string, messages: Messages) {
  const [source, setSource] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState<'cancel' | 'save' | 'validate' | null>(null)
  useEffect(() => {
    let active = true
    setMessage(null)
    setSaved(false)
    void window.argo.beginProjectSetup({ projectId }).then((reply) => {
      if (!active) return
      if (reply.type === 'project.setup.editing') setSource(reply.source)
      else if (reply.type === 'project.error') setMessage(reply.message)
    })
    return () => {
      active = false
    }
  }, [projectId])
  const save = async () => {
    setSaving('save')
    setMessage(null)
    const reply = await window.argo.saveProjectSetup({ projectId, source })
    if (reply.type === 'project.setup.editing') {
      setSource(reply.source)
      setMessage(messages.saved)
      setSaved(true)
    } else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(null)
  }
  const validate = async () => {
    setSaving('validate')
    setMessage(null)
    const reply = await window.argo.validateProjectSetup({ projectId })
    if (reply.type === 'project.setup.validated') {
      setMessage(reply.valid ? messages.valid : messages.invalid)
    } else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(null)
  }
  const cancel = async () => {
    setSaving('cancel')
    setMessage(null)
    const reply = await window.argo.cancelProjectSetup({ projectId })
    if (reply.type === 'project.setup.cancelled') setMessage(messages.cancelled)
    else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(null)
  }
  return { cancel, message, saved, save, saving, setSaved, setSource, source, validate }
}
