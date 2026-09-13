import './i18n/config'

import { RouterProvider } from 'react-router'
import { cockpitRouter } from './modules/cockpit/routes/CockpitRouter'
import { ProjectsProvider } from './modules/projects/state/ProjectsContext'

export function App() {
  return (
    <ProjectsProvider>
      <RouterProvider router={cockpitRouter} />
    </ProjectsProvider>
  )
}
