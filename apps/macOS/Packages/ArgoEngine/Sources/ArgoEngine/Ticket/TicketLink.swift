import Foundation

/// Which Ticket a Session serves, read off its git context (`CONTEXT.md` L1 · Ticket).
///
/// DERIVED, not DIRECT: `docs/agents/worktrees.md` fixes a ticket branch at `argo/#<N>-<slug>` and
/// a worktree folder at `ticket-<N>-<slug>`, and this reads that convention back. Nothing here
/// confirms the Ticket exists — a number that resolves to nothing degrades to no link.
///
/// Derived from the branch rather than from the first prompt because `branch` is the join key
/// (`CONTEXT.md` L3) and every Session has one read for it, external Sessions included.
public enum TicketLink {
    /// The worktree folder's stem, as `docs/agents/worktrees.md` fixes it.
    private static let worktreePrefix = "ticket-"

    /// The Ticket number this git context names, and `nil` where neither half names one.
    ///
    /// The branch is asked first because a folder is reused across tickets where a branch is
    /// re-cut per ticket. The folder is the fallback that covers the window between
    /// `EnterWorktree` and the `git branch -m` rename, when only it carries the number.
    public static func number(branch: String?, workspaceLocation: String?) -> Int? {
        if let branch, let number = numberAfterHash(in: branch) {
            return number
        }
        guard let workspaceLocation else { return nil }
        return numberInWorktreeFolder(named: URL(fileURLWithPath: workspaceLocation)
            .lastPathComponent)
    }

    /// The digits after the first `#`. A `#` with no digit behind it names nothing.
    private static func numberAfterHash(in branch: String) -> Int? {
        guard let hash = branch.firstIndex(of: "#") else { return nil }
        return number(leading: branch[branch.index(after: hash)...])
    }

    private static func numberInWorktreeFolder(named folder: String) -> Int? {
        guard folder.hasPrefix(worktreePrefix) else { return nil }
        return number(leading: folder.dropFirst(worktreePrefix.count))
    }

    /// The leading run of digits, and `nil` where there is none or where it is not a ticket
    /// number: providers number Tickets from one, so `#0` is a misread rather than a link.
    private static func number(leading text: Substring) -> Int? {
        guard let number = Int(text.prefix(while: \.isNumber)), number > 0 else { return nil }
        return number
    }
}
