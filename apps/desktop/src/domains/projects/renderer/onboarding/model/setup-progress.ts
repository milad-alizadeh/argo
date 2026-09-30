// Streamed step status during planning and application (#2381 canonical contract). Separate
// schemas because the two phases stream over separate IPC channels, even though the shape matches.

import { z } from 'zod'

const setupStepStatusSchema = z.enum(['pending', 'running', 'waiting-for-user', 'passed', 'failed'])
export type SetupStepStatus = z.infer<typeof setupStepStatusSchema>
