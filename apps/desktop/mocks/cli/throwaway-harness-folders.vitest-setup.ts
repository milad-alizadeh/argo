// Vitest's setup file: every test runs against throwaway Harness folders, and fails
// the run if the person's own config changed.
import { afterAll } from 'vitest'
import { guardRealUserConfig, isolateHarnessFolders } from './real-user-config'

afterAll(isolateHarnessFolders())
afterAll(guardRealUserConfig())
