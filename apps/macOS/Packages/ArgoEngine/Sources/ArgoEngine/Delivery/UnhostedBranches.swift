import Foundation

/// Which branches the code host answered that it holds NO pull request for, and the commit each of
/// those answers was measured against (#1619).
///
/// The empty answer is the one answer that can legitimately change, so this is not a cache of it.
/// It is the record of what it was measured against: a branch cannot grow a pull request this tick
/// would miss without a push, because an OPENED pull request is open and arrives on the in-flight
/// listing every tick already runs. A push moves the commit held here, and the branch is asked
/// about again.
///
/// Keyed by Project as well as branch, because two Projects share `main` and one's empty answer
/// says nothing about the other's.
struct UnhostedBranches: Sendable {
    private struct Branch: Hashable, Sendable {
        let projectID: String
        let branch: String
    }

    private var answeredAt: [Branch: String] = [:]

    /// Whether the host's last answer for this branch was "nothing", given at the commit the branch
    /// is on now.
    ///
    /// A branch the worktree listing named no commit for is never held: with nothing to compare,
    /// the tick pays the request rather than claiming the branch cannot have moved (degrade-down).
    func holds(_ branch: String, at headSha: String?, in projectID: String) -> Bool {
        guard let headSha else { return false }
        return answeredAt[Branch(projectID: projectID, branch: branch)] == headSha
    }

    /// Write down what one branch's own request answered. A pull request of ANY state clears the
    /// branch, so nothing here can hold a branch the host has since said something about.
    mutating func record(
        _ pullRequest: DeliveryPullRequest?,
        ofBranch branch: String,
        at headSha: String?,
        in projectID: String,
    ) {
        answeredAt[Branch(projectID: projectID, branch: branch)] = pullRequest == nil
            ? headSha
            : nil
    }

    /// Forget every branch of this Project that is not one of these — the worktrees reaped since
    /// the last read, which would otherwise pile up for the life of the window. Other Projects'
    /// branches are untouched: this read says nothing about branches it never looked at.
    mutating func prune(to branches: Set<String>, in projectID: String) {
        answeredAt = answeredAt.filter {
            $0.key.projectID != projectID || branches.contains($0.key.branch)
        }
    }
}
