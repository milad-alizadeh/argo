import type { CSSProperties, ReactNode } from 'react'
import {
  ATTACHMENT_ENTER_MS,
  ATTACHMENT_EXIT_MS,
} from '@/platform/renderer/components/exit-presence'

// React's style type names no custom properties, so the times are asserted into it.
const motion = {
  '--attachment-enter': `${ATTACHMENT_ENTER_MS}ms`,
  '--attachment-exit': `${ATTACHMENT_EXIT_MS}ms`,
} as CSSProperties

// The tray above the composer; it hands its cards' animation times to `composer-content.css`.
export function AttachmentTray({ children }: { children: ReactNode }) {
  return (
    <div className="session-page__composer-attachments" style={motion}>
      {children}
    </div>
  )
}
