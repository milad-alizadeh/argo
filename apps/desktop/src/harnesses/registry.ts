import type { Harness } from './harness'
import type { HarnessRegistration } from './registration'

export type HarnessRegistry = { [Id in Harness]: HarnessRegistration<Id> }
