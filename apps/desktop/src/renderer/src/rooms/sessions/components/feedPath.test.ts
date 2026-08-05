import { describe, expect, it } from 'vitest'
import { relativeTo, splitPath } from './feedPath'

const ROOT = '/Users/me/argo/.claude/worktrees/ticket-318'

describe('a path under the session root', () => {
  it('drops the root, which every row on the feed shares', () => {
    expect(relativeTo(`${ROOT}/apps/desktop/src/shared/feedRows.ts`, ROOT)).toBe(
      'apps/desktop/src/shared/feedRows.ts',
    )
  })

  it('drops it whether or not the root was given with a trailing separator', () => {
    expect(relativeTo(`${ROOT}/a.ts`, `${ROOT}/`)).toBe('a.ts')
  })
})

// The shortening claims the file is at that position INSIDE this session's tree. A path that is not
// in the tree is a different file, and rendering it as though it were would be a false claim about
// where the agent had been.
describe('a path outside the session root', () => {
  it('is left absolute rather than shortened against a root it is not under', () => {
    expect(relativeTo('/tmp/argo-shots/cockpit.png', ROOT)).toBe('/tmp/argo-shots/cockpit.png')
  })

  it('is left alone when the root is a PREFIX but not a parent', () => {
    expect(relativeTo(`${ROOT}-inline-media/a.ts`, ROOT)).toBe(`${ROOT}-inline-media/a.ts`)
  })

  it('is left alone when there is no root to measure against', () => {
    expect(relativeTo('/Users/me/a.ts', null)).toBe('/Users/me/a.ts')
  })
})

describe('splitting what the row shows', () => {
  it('lifts the filename out and keeps the rest as its directory', () => {
    expect(splitPath(`${ROOT}/apps/desktop/src/shared/feedRows.ts`, ROOT)).toEqual({
      name: 'feedRows.ts',
      dir: 'apps/desktop/src/shared',
    })
  })

  // `null`, not `''`: the caller renders nothing at all rather than an empty cell still spending
  // the gap beside it.
  it('reports no directory for a file at the root', () => {
    expect(splitPath(`${ROOT}/README.md`, ROOT)).toEqual({ name: 'README.md', dir: null })
  })

  it('keeps an absolute path whole when it is outside the root', () => {
    expect(splitPath('/tmp/shots/a.png', ROOT)).toEqual({ name: 'a.png', dir: '/tmp/shots' })
  })

  it('reads a bare filename as its own name', () => {
    expect(splitPath('feedRows.ts', ROOT)).toEqual({ name: 'feedRows.ts', dir: null })
  })

  // A trailing separator names a DIRECTORY. There is no file to lift out, so it reads whole rather
  // than as an empty name beside its own parent.
  it('leaves a directory whole rather than lifting an empty name out of it', () => {
    expect(splitPath(`${ROOT}/apps/desktop/`, ROOT)).toEqual({ name: 'apps/desktop/', dir: null })
  })
})
