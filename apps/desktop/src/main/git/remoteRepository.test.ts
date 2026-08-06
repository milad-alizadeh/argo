import { describe, expect, it } from 'vitest'
import { parseRemoteUrl } from './remoteRepository'

// Which repository the Work Item provider port reads. `origin` is the only DIRECT answer —
// asking the user to type what git already knows would be a second answer that can disagree.

describe('the two spellings git writes', () => {
  it('reads an https remote', () => {
    expect(parseRemoteUrl('https://github.com/milad-alizadeh/argo.git')).toEqual({
      owner: 'milad-alizadeh',
      repository: 'argo',
    })
  })

  it('reads an scp-like ssh remote', () => {
    expect(parseRemoteUrl('git@github.com:milad-alizadeh/argo.git')).toEqual({
      owner: 'milad-alizadeh',
      repository: 'argo',
    })
  })

  it('reads a remote written without the .git suffix', () => {
    expect(parseRemoteUrl('https://github.com/milad-alizadeh/argo')).toEqual({
      owner: 'milad-alizadeh',
      repository: 'argo',
    })
  })

  it('reads an ssh:// remote', () => {
    expect(parseRemoteUrl('ssh://git@github.com/milad-alizadeh/argo.git')).toEqual({
      owner: 'milad-alizadeh',
      repository: 'argo',
    })
  })
})

describe('remotes that are not a GitHub repository', () => {
  it('refuses another host', () => {
    expect(parseRemoteUrl('git@gitlab.com:milad-alizadeh/argo.git')).toBeNull()
  })

  it('refuses a host that merely contains the name in its path', () => {
    expect(parseRemoteUrl('https://mirror.internal/github.com/milad-alizadeh/argo')).toBeNull()
  })

  it('refuses a path that is not exactly owner and repository', () => {
    expect(parseRemoteUrl('https://github.com/milad-alizadeh')).toBeNull()
    expect(parseRemoteUrl('https://github.com/milad-alizadeh/argo/tree/main')).toBeNull()
  })

  it('refuses a local path remote', () => {
    expect(parseRemoteUrl('/Users/dev/code/argo')).toBeNull()
  })
})
