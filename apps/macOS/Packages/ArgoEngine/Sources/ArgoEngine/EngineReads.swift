import Foundation

/// The reads an `Engine` is composed from, as ONE value.
///
/// They are a clump: production supplies none of them and every test that supplies one supplies
/// several, so five parameters on `Engine.init` were five ways to say the same thing
/// (`rules/code-style.md` — the fourth positional parameter is forbidden; pass a structure).
///
/// Stored `var`s with no hand-written initializer, so the memberwise one carries every default and
/// a caller names only the read it is about — and so this file declares no initializer over the
/// parameter cap it exists to keep `Engine` under. The memberwise initializer is `internal`, which
/// is the whole public surface production needs: it composes `.ofThisMachine`, and the suites reach
/// the rest through `@testable`.
public struct EngineReads: Sendable {
    /// Everything read off the machine Argo is running on: git for the checkout and its worktrees,
    /// the process table for liveness, and the file system for a path's real spelling.
    public static let ofThisMachine = EngineReads()

    public var checkout: CheckoutRead = gitCheckoutRead
    public var worktrees: WorktreeEnumerationRead = gitWorktreeEnumerationRead
    public var workspace: WorkspaceRead = gitWorkspaceRead
    public var liveness: LivenessRead = processLivenessRead
    public var paths: PathResolutionRead = realpathResolutionRead
}
