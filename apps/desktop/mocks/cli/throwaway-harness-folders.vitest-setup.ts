// Vitest's setup file: every test runs against throwaway Harness folders.
import { afterAll } from 'vitest'
import { isolateHarnessFoldersForRun } from './real-user-config'

afterAll(isolateHarnessFoldersForRun())
