import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { AppQueryProvider } from './app-query-provider'
import './styles/globals.css'

const host = document.getElementById('root')
if (!host) throw new Error('index.html is missing #root')

createRoot(host).render(
  <StrictMode>
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  </StrictMode>,
)
