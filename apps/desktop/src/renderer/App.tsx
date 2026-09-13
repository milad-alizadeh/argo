import './i18n/config'

import { RouterProvider } from 'react-router'

import { CockpitProviders } from './modules/cockpit/components/CockpitProviders'
import { cockpitRouter } from './modules/cockpit/routes/CockpitRouter'

export function App() {
  return (
    <CockpitProviders>
      <RouterProvider router={cockpitRouter} />
    </CockpitProviders>
  )
}
