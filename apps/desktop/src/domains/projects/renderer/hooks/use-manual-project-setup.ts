import { useEffect, useState } from 'react'

type Messages = { saved: string; valid: string; invalid: string }

export function useManualProjectSetup(projectId: string, messages: Messages) {
  const [source, setSource] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
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
    setSaving(true)
    setMessage(null)
    const reply = await window.argo.saveProjectSetup({ projectId, source })
    if (reply.type === 'project.setup.editing') {
      setSource(reply.source)
      setMessage(messages.saved)
      setSaved(true)
    } else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(false)
  }
  const validate = async () => {
    setSaving(true)
    setMessage(null)
    const reply = await window.argo.validateProjectSetup({ projectId })
    if (reply.type === 'project.setup.validated') {
      setMessage(reply.valid ? messages.valid : messages.invalid)
    } else if (reply.type === 'project.error') setMessage(reply.message)
    setSaving(false)
  }
  return { message, saved, save, saving, setSaved, setSource, source, validate }
}
