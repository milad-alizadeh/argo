import './i18n/config'

import { RouterProvider } from 'react-router'

import { cockpitRouter } from './cockpit/routes/cockpit-router'

export function App() {
  return <RouterProvider router={cockpitRouter} />
}
