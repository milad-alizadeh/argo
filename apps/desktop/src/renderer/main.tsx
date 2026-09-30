import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'

import { IconContext } from '@phosphor-icons/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SessionChanges } from '@/domains/sessions/renderer'
import { AppQueryProvider } from '@/platform/renderer/app-query-provider'
import { AutoHideScrollbars } from '@/platform/renderer/auto-hide-scrollbars'
import { App } from './app'
import '@/platform/renderer/styles/globals.css'

const host = document.getElementById('root')
if (!host) throw new Error('index.html is missing #root')

createRoot(host).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'regular' }}>
      <AutoHideScrollbars>
        <AppQueryProvider>
          <SessionChanges />
          <App />
        </AppQueryProvider>
      </AutoHideScrollbars>
    </IconContext.Provider>
  </StrictMode>,
)
