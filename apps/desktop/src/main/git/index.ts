// Reading and acting on a Project's PRIMARY checkout (ADR-0004: main runs git). Facts out,
// safe operations in; every git invocation in this process goes through `runGit`.

export { wireGit } from './bridge'
export { readGitFacts } from './gitFacts'
export { runGitOperation } from './operations'
export { type RemoteRepo, readRemoteRepo } from './remoteRepo'
