import './i18n'

import { RouterProvider } from 'react-router'

import { useAppearance } from '@/platform/renderer/use-appearance'
import { appRouter } from './app-router'

export function App() {
  useAppearance()
  return <RouterProvider router={appRouter} />
}
