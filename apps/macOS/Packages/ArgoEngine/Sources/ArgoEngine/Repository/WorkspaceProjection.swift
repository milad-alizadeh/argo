/// The git working context of one working tree (`CONTEXT.md` L3 · Workspace), as git answers it.
///
/// Distinct from `CheckoutProjection`, which is the ONE checkout the window is pointed at: this is
/// read per worktree, and a repository with four of them has four of these. Read per WORKTREE and
/// not per Session, so a worktree that outlived the run that made it is a Workspace anyway.
public struct WorkspaceProjection: Equatable, Sendable {
    /// Whether the folder is the repository's own checkout or one it was given (`CONTEXT.md` L3).
    /// Declared once here and aliased by the shell, never restated as a second enum.
    public enum Kind: Equatable, Sendable {
        case main
        case worktree
    }

    public let kind: Kind
    /// The branch the folder is on, and the join key Delivery is addressed by (`CONTEXT.md` L3).
    /// Absent for a detached HEAD, and for a repository git would not name a branch in.
    public let branch: String?
    /// The ref this branch is measured against — the remote's own default, as git names it. Absent
    /// for a repository with no remote, which has no shared base to name.
    public let baseRef: String?
    /// The commit checked out here, whole and in git's own form. What a Diff is addressed by
    /// (`CONTEXT.md` L4 · Diff).
    public let headSha: String?
    /// How many files are changed and not committed. A count of what git reported, so a zero here
    /// means git said nothing was dirty — never that nobody asked.
    public let dirty: Int
    /// How far the branch has drifted from its upstream — see `UpstreamDivergence` for why the two
    /// counts travel together and why a branch with no upstream has none.
    public let divergence: UpstreamDivergence?
    /// How many Agents are working in this folder. Not a git fact and never read as one: the
    /// listing says a worktree exists, and the roster says who is in it — so a worktree nobody is
    /// running in is honestly zero rather than missing.
    public let sharedCount: Int
    /// How Argo knows an Agent is HERE, which is the only part of this a tier applies to: the
    /// counts above are all read back from git whoever is in the folder. `derived` until something
    /// that knows the Agent's provenance says otherwise — see `known(via:)`.
    public let tier: Tier

    public init(
        kind: Kind,
        branch: String?,
        baseRef: String? = nil,
        headSha: String? = nil,
        dirty: Int,
        divergence: UpstreamDivergence?,
        sharedCount: Int = 0,
        tier: Tier = .derived,
    ) {
        self.kind = kind
        self.branch = branch
        self.baseRef = baseRef
        self.headSha = headSha
        self.dirty = dirty
        self.divergence = divergence
        self.sharedCount = sharedCount
        self.tier = tier
    }

    /// The same reading, with how many Agents are in the folder folded in. Applied where the roster
    /// is known, because the reader that asked git has no idea who is standing in its answer.
    func shared(by count: Int) -> WorkspaceProjection {
        rewriting(sharedCount: count, tier: tier)
    }

    /// The same reading, told as one Agent's.
    ///
    /// DIRECT only for a Session Argo spawned: Argo chose the folder and made the worktree, so the
    /// identity is its own record rather than an inference. `external` never was Argo's, and
    /// `orphaned` was but the record went with the process — both are read back off git, and both
    /// degrade down (`CONTEXT.md`, Honesty tier).
    func known(via provenance: SessionProvenance) -> WorkspaceProjection {
        switch provenance {
        case .managed:
            rewriting(sharedCount: sharedCount, tier: .direct)
        case .external, .orphaned:
            rewriting(sharedCount: sharedCount, tier: .derived)
        }
    }

    private func rewriting(sharedCount: Int, tier: Tier) -> WorkspaceProjection {
        WorkspaceProjection(
            kind: kind,
            branch: branch,
            baseRef: baseRef,
            headSha: headSha,
            dirty: dirty,
            divergence: divergence,
            sharedCount: sharedCount,
            tier: tier,
        )
    }
}
