import './i18n/config'

import { RouterProvider } from 'react-router'

import { cockpitRouter } from './modules/cockpit/routes/CockpitRouter'

export function App() {
  return <RouterProvider router={cockpitRouter} />
}
