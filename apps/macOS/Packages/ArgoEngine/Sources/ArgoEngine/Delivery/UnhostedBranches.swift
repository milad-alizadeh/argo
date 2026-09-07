import Foundation

/// Which branches the code host answered that it holds NO pull request for, and the commit each of
/// those answers was measured against (#1619).
///
/// A branch cannot grow a pull request a tick would miss without a push: an OPENED pull request is
/// open, and arrives on the in-flight listing every tick already runs. So a push is the only thing
/// that can make the answer stale, and a push moves the commit held here.
///
/// Keyed by the Binding's scope rather than by Project, because the answer is the repository's: two
/// Projects on one repository share it, and one Project re-pointed at another repository must not
/// inherit it.
struct UnhostedBranches: Sendable {
    private struct Branch: Hashable, Sendable {
        let scope: String
        let branch: String
    }

    private var commit: [Branch: String] = [:]

    /// Whether the host's last answer for this branch was "nothing", measured at the commit the
    /// branch is on now.
    ///
    /// A branch the worktree listing named no commit for never answers true: with nothing to
    /// compare, the tick pays the request rather than claiming the branch cannot have moved
    /// (degrade-down).
    func answeredNothing(forBranch branch: String, at headSha: String?, in scope: String) -> Bool {
        guard let headSha else { return false }
        return commit[Branch(scope: scope, branch: branch)] == headSha
    }

    /// Write down what one branch's own request answered. A pull request of ANY state clears the
    /// branch, so nothing here can hold a branch the host has since said something about.
    mutating func record(
        _ pullRequest: DeliveryPullRequest?,
        ofBranch branch: String,
        at headSha: String?,
        in scope: String,
    ) {
        commit[Branch(scope: scope, branch: branch)] = pullRequest == nil ? headSha : nil
    }

    /// Forget everything but these branches of this scope.
    ///
    /// It drops three kinds of entry, and the first is a correctness one: a branch the in-flight
    /// listing now covers must be forgotten, or its answer from before the pull request existed
    /// outlives the pull request and strands the branch once it merges off the listing. The other
    /// two are size — the worktrees reaped since the last read, and every other scope this
    /// derivation was ever pointed at.
    mutating func keep(_ branches: Set<String>, in scope: String) {
        commit = commit.filter { $0.key.scope == scope && branches.contains($0.key.branch) }
    }
}
