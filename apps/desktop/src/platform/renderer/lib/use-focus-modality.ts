import { useEffect } from 'react'

type FocusModalityInstallation = {
  references: number
  onKeyDown: (event: KeyboardEvent) => void
  onPointerDown: () => void
  previousValue: string | undefined
}

const installations = new WeakMap<Document, FocusModalityInstallation>()
function release(document: Document, installation: FocusModalityInstallation) {
  installation.references -= 1
  if (installation.references > 0) return
  document.removeEventListener('keydown', installation.onKeyDown, true)
  document.removeEventListener('pointerdown', installation.onPointerDown, true)
  if (installation.previousValue === undefined) {
    delete document.documentElement.dataset.focusModality
  } else {
    document.documentElement.dataset.focusModality = installation.previousValue
  }
  installations.delete(document)
}

export function useFocusModality() {
  useEffect(() => {
    const ownerDocument = document
    const existing = installations.get(ownerDocument)
    if (existing) {
      existing.references += 1
      return () => release(ownerDocument, existing)
    }

    const root = ownerDocument.documentElement
    const installation: FocusModalityInstallation = {
      references: 1,
      onKeyDown: (event) => {
        if (event.key !== 'Tab') return
        root.dataset.focusModality = 'keyboard'
      },
      onPointerDown: () => {
        root.dataset.focusModality = 'pointer'
      },
      previousValue: root.dataset.focusModality,
    }
    ownerDocument.addEventListener('keydown', installation.onKeyDown, true)
    ownerDocument.addEventListener('pointerdown', installation.onPointerDown, true)
    root.dataset.focusModality = 'pointer'
    installations.set(ownerDocument, installation)
    return () => release(ownerDocument, installation)
  }, [])
}
