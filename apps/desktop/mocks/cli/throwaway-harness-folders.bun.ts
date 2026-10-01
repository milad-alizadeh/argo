// Bun's test preload (bunfig.toml): every test runs against throwaway Harness folders.
import { afterAll } from 'bun:test'
import { isolateHarnessFoldersForRun } from './real-user-config'

afterAll(isolateHarnessFoldersForRun())
