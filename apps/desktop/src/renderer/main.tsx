import { UnreadMarkerBrowserPrototype } from '@/domains/sessions/renderer/roster'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppQueryProvider } from '@/platform/renderer/app-query-provider'
import { App } from './app'
import '@/platform/renderer/styles/globals.css'

const host = document.getElementById('root')
if (!host) throw new Error('index.html is missing #root')

const browserPrototype =
  window.location.hostname === 'localhost' &&
  window.argo === undefined &&
  window.location.hash.includes('variant=')

createRoot(host).render(
  <StrictMode>
    {browserPrototype ? (
      <UnreadMarkerBrowserPrototype />
    ) : (
      <AppQueryProvider>
        <App />
      </AppQueryProvider>
    )}
  </StrictMode>,
)
