import Foundation

/// What archiving a Session does to the worktree it was working in (#1398).
///
/// Archiving is a gesture on a row, and the row's folder outlives it: nothing local fires when a
/// pull request lands, so a worktree stayed until somebody ran `worktrees:gc` by hand. Archiving is
/// the moment a reader says they are finished with the work, which is the moment to ask.
///
/// The whole pass is here rather than at the gesture, for `endSession(archiving:)`'s reason: what
/// archiving MEANS is the engine's to state. The app supplies one thing it cannot know — which
/// Binding the Project's code host reads through.
@MainActor
public extension Hub {
    /// Take the worktree of a Session being archived, where it is Argo's own and its branch has
    /// landed. Answers what it decided, which is what a suite reads and what nothing else does.
    ///
    /// The Binding arrives as a closure rather than a value because resolving one reads the
    /// keychain: this way a gesture that reaps nothing — an unarchive, a Session in no worktree,
    /// a dirty one — never pays for an answer it was never going to use.
    @discardableResult
    func reapWorktree(
        archiving isArchived: Bool,
        id sessionID: String,
        through resolving: @MainActor () async -> BindingResolution,
    ) async
        -> WorktreeReaping.Verdict {
        let local = worktreeToReap(archiving: isArchived, id: sessionID)
        guard case let .reap(candidate) = local else { return local }
        // The code host is asked LAST, and only about a worktree every local check cleared.
        let verdict = await candidate.verdict(landed: hasLanded(candidate, through: resolving()))
        guard case .reap = verdict else { return verdict }
        await reap(candidate)
        return verdict
    }

    /// The worktree an archive gesture MAY take with it, before the landed question is asked.
    ///
    /// The `guard` on `isArchived` is here rather than at the gesture for `endSession`'s reason: it
    /// is a RULE about archiving, not a step in performing one. Putting a Session back starts no
    /// worktree, so it removes none either.
    func worktreeToReap(archiving isArchived: Bool, id sessionID: String)
        -> WorktreeReaping.Verdict {
        guard isArchived else { return .hold(.notArchiving) }
        guard let worktree = readings.worktree(inCwd: session(id: sessionID)?.cwd) else {
            return .hold(.unread)
        }
        return WorktreeReaping.candidate(at: worktree.path, workspace: worktree.workspace)
    }

    /// One cleared worktree taken off disk, through the engine's write.
    ///
    /// Asked of the repository the Hub is pointed at rather than of the worktree itself: git
    /// removes a working tree from the checkout that holds it, and the folder about to be deleted
    /// is not a directory to be standing in while it happens.
    @discardableResult
    func reap(_ candidate: WorktreeReaping.Candidate) async -> WorktreeRemoval {
        let removal = await engine.removeWorktree(candidate, in: project.url)
        // The listing this was decided off now names a folder that is gone. Re-read rather than
        // waiting out the poll, so the cockpit does not go on offering a Workspace for it.
        await readings.refreshWorkspaces()
        return removal
    }
}

@MainActor
private extension Hub {
    /// Whether the code host says this branch merged — the one fact nothing local can answer,
    /// because a squash-merged branch is no ancestor of anything (`scripts/worktree-gc.sh`).
    ///
    /// A Binding that is unbound, broken or throwing answers `false`, and the worktree stays: a
    /// merge nobody could confirm is not a merge.
    func hasLanded(
        _ candidate: WorktreeReaping.Candidate, through resolution: BindingResolution,
    ) async
        -> Bool {
        guard case let .ready(binding) = resolution else { return false }
        let delivery = try? await codeHost.delivery(
            ofBranch: candidate.branch, in: binding.binding.scope, grant: binding.grant,
        )
        return delivery?.pullRequest?.isMerged == true
    }
}
