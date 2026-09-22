import './i18n'

import { RouterProvider } from 'react-router'

import { useAppearance } from '@/platform/renderer/appearance/hooks/use-appearance'
import { cockpitRouter } from '@/renderer/cockpit-router'

export function App() {
  useAppearance()
  return <RouterProvider router={cockpitRouter} />
}
