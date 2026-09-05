import Foundation

/// Whether one working tree may be removed, and why not where it may not (#1398).
///
/// The rules follow `scripts/worktree-gc.sh`'s, restated over the readings Argo already holds
/// rather than over a second set of subprocesses: Argo's own linked worktree, nothing uncommitted,
/// nothing unpushed, nobody else standing in it, and the branch landed. Every one of them is a
/// reason NOT to remove, so an unread fact holds the worktree — the destructive branch is not the
/// one to take on unknown.
///
/// One of gc's checks has no equivalent and needs none: gc holds a worktree TOUCHED in the last
/// half hour, because it sweeps unasked and a session may be mid-Turn in one. This runs on an
/// explicit gesture on that very row, so the Agent count below is the question actually being
/// asked — is anybody else in here.
///
/// Read in two steps because they cost different things. `candidate(at:workspace:)` is free and
/// answers off the sweep the cockpit already has; `Candidate.verdict(landed:)` takes the one fact
/// that costs a request to the code host, so a dirty worktree is refused without asking anybody.
public enum WorktreeReaping {
    /// Argo's own worktrees live here, by convention rather than by anything git enforces
    /// (`WorktreeEntry.kind`). Scoped deliberately: a worktree a person made somewhere else is
    /// theirs, and archiving a row is not permission to delete it.
    static let folder = "/.claude/worktrees/"

    /// What the rules answered about one worktree.
    public enum Verdict: Equatable, Sendable {
        case reap(Candidate)
        case hold(Refusal)
    }

    /// Why a worktree stays. Each names the check it failed in the words `worktree-gc` uses for it.
    public enum Refusal: Equatable, Sendable {
        /// The gesture was putting a Session BACK. Nothing is removed on the way in, so nothing is
        /// removed on the way out either.
        case notArchiving
        /// The repository's own checkout, or a worktree outside `.claude/worktrees/`.
        case notArgosOwn
        /// No Workspace was read for the folder, or git named no branch in it. An unread worktree
        /// is not a clean one.
        case unread
        /// Files changed and not committed, as git counted them.
        case dirty(Int)
        /// Commits the upstream has not seen — and a branch with NO upstream, which is the same
        /// fact read down: an unpushed worktree is the only copy of the work.
        case unpushed(Int)
        /// More than one Agent is in the folder. The Session being archived is one of them.
        case held(Int)
        /// The code host does not say this branch merged. This repo squash-merges, so nothing
        /// local could answer it — see `worktree-gc.sh`.
        case notLanded
    }

    /// A worktree that passed every local check, holding the two names the removal needs.
    ///
    /// Its own type rather than a `Bool` beside a path, so the landed question can only be asked
    /// about a worktree the local checks already cleared.
    public struct Candidate: Equatable, Sendable {
        public let path: String
        public let branch: String

        /// The last check, and the one that costs a request. `landed` is what the code host said
        /// about this branch's pull request; a host that was not asked, could not be reached or
        /// holds no pull request answers `false` and the worktree stays.
        public func verdict(landed: Bool) -> Verdict {
            landed ? .reap(self) : .hold(.notLanded)
        }
    }

    /// Everything answerable off the sweep, in `worktree-gc`'s own order.
    ///
    /// `workspace` is the reading for THIS worktree — the deepest one holding the Session's folder,
    /// which is what `WorldReadings.worktree(inCwd:)` answers with.
    public static func candidate(at path: String, workspace: WorkspaceProjection?) -> Verdict {
        guard let workspace else { return .hold(.unread) }
        guard workspace.kind == .worktree, path.contains(folder) else {
            return .hold(.notArgosOwn)
        }
        guard let branch = workspace.branch else { return .hold(.unread) }
        guard workspace.dirty == 0 else { return .hold(.dirty(workspace.dirty)) }
        // A branch git CAN measure against an upstream has to be level with it. One it cannot is
        // not held on that, and the direction matters: GitHub deletes a head branch as it
        // squash-merges it, so a worktree in exactly the state this reaps has no upstream ref left
        // to measure against and reads as no divergence at all. Held on absence, the check would
        // refuse every landed worktree there is.
        //
        // What keeps that safe is the landed check below it, which a branch nobody ever pushed
        // cannot pass — there is no pull request to have merged. `worktree-gc.sh` guards its own
        // `rev-list` on the upstream existing, for this reason.
        if let ahead = workspace.divergence?.ahead, ahead > 0 {
            return .hold(.unpushed(ahead))
        }
        // The archiving Session is itself a holder, and the count is one sweep old at most — so
        // one is the folder being emptied and two is somebody else still in it.
        guard workspace.held.count <= 1 else { return .hold(.held(workspace.held.count)) }
        return .reap(Candidate(path: path, branch: branch))
    }
}
