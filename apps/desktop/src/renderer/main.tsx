import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../platform/renderer/app'
import { AppQueryProvider } from '../platform/renderer/app-query-provider'
import '../platform/renderer/styles/globals.css'

const host = document.getElementById('root')
if (!host) throw new Error('index.html is missing #root')

createRoot(host).render(
  <StrictMode>
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  </StrictMode>,
)
