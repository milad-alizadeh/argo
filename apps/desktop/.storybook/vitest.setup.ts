import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import preview from './preview'

// Owning setProjectAnnotations makes this file the source of truth for project annotations, so
// @storybook/addon-vitest skips injecting its own. It loads only in the Vitest run — never in
// `storybook dev` — and renders every story as a test (no pixel assertion).
const project = setProjectAnnotations([preview])

beforeAll(project.beforeAll)
