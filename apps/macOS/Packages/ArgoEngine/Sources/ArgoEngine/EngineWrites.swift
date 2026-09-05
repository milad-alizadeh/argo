import Foundation

/// The writes an `Engine` is composed from, as ONE value — `EngineReads`' other half.
///
/// Apart from the reads rather than folded in with them, because the difference is the one a reader
/// of a test needs: a suite that supplies a read is describing a machine, and a suite that supplies
/// a write is describing what Argo did to one.
public struct EngineWrites: Sendable {
    /// Everything written to the machine Argo is running on. One entry so far: git, removing a
    /// landed worktree an archived Session is finished with (#1398).
    public static let ofThisMachine = EngineWrites()

    public var removeWorktree: WorktreeRemovalWrite = gitWorktreeRemovalWrite
}
