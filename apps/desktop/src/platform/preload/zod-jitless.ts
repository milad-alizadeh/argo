import { z } from 'zod'

// Electron's isolated preload world blocks Zod's generated validator path. A schema's fast-path
// eligibility is decided when it is built, not when it is first parsed, so this must run before
// any module that calls `z.strictObject`/`z.object` — including through a transitive import.
// Importing this file first in `preload.ts` is what gives it that ordering; setting the config
// from inside `preload.ts` itself runs after its own imports have already built every schema.
z.config({ jitless: true })
