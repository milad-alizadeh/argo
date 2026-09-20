import './i18n'

import { RouterProvider } from 'react-router'

import { cockpitRouter } from '@/renderer/cockpit-router'

export function App() {
  return <RouterProvider router={cockpitRouter} />
}
