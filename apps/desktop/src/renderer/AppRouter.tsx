import { Navigate, RouterProvider, createHashRouter } from 'react-router'

import { SessionsScreen } from './modules/sessions/screens/SessionsScreen'

const router = createHashRouter([
  { path: '/sessions', element: <SessionsScreen /> },
  { path: '*', element: <Navigate replace to="/sessions" /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
