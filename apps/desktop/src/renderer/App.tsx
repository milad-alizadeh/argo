import './i18n/config'

import { RouterProvider } from 'react-router'

import { useAppearance } from './modules/appearance/hooks/useAppearance'
import { cockpitRouter } from './modules/cockpit/routes/CockpitRouter'

export function App() {
  useAppearance()
  return <RouterProvider router={cockpitRouter} />
}
