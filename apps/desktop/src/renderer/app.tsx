import './i18n'

import { RouterProvider } from 'react-router'

import { useAppearance } from '@/platform/renderer/use-appearance'
import { cockpitRouter } from './cockpit-router'

export function App() {
  useAppearance()
  return <RouterProvider router={cockpitRouter} />
}
