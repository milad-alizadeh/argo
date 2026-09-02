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

    /// The refs git addresses this folder by. Each is absent wherever git would not name one.
    public struct Refs: Equatable, Sendable {
        /// The branch the folder is on, and the join key Delivery is addressed by
        /// (`CONTEXT.md` L3). Absent for a detached HEAD, and for a repository git would not name
        /// a branch in.
        public let branch: String?
        /// The ref this branch is measured against — the remote's own default, as git names it.
        /// Absent wherever git will not name one, which is more often than a repository having no
        /// remote: see `WorkspaceReader.baseRef(at:)`.
        public let baseRef: String?
        /// The commit checked out here, whole and in git's own form. What a Diff is addressed by
        /// (`CONTEXT.md` L4 · Diff).
        public let headSha: String?

        public init(branch: String?, baseRef: String? = nil, headSha: String? = nil) {
            self.branch = branch
            self.baseRef = baseRef
            self.headSha = headSha
        }
    }

    /// What the folder is holding that has not landed.
    public struct Drift: Equatable, Sendable {
        /// How many files are changed and not committed. A count of what git reported, so a zero
        /// here means git said nothing was dirty — never that nobody asked.
        public let dirty: Int
        /// How far the branch has drifted from its upstream — see `UpstreamDivergence` for why the
        /// two counts travel together and why a branch with no upstream has none.
        public let divergence: UpstreamDivergence?

        public init(dirty: Int, divergence: UpstreamDivergence?) {
            self.dirty = dirty
            self.divergence = divergence
        }
    }

    public let kind: Kind
    // Each is documented on its `Refs` or `Drift` slot above.
    public let branch: String?
    public let baseRef: String?
    public let headSha: String?
    public let dirty: Int
    public let divergence: UpstreamDivergence?
    /// Who is in this folder and how Argo knows they are — the two facts here that are not git's.
    /// See `WorkspaceHolders` for why they sit apart from the counts above rather than beside them.
    public let held: WorkspaceHolders

    public init(
        kind: Kind,
        refs: Refs,
        drift: Drift,
        held: WorkspaceHolders = .unattributed,
    ) {
        self.kind = kind
        self.branch = refs.branch
        self.baseRef = refs.baseRef
        self.headSha = refs.headSha
        self.dirty = drift.dirty
        self.divergence = drift.divergence
        self.held = held
    }

    /// The same reading, with how many Agents are in the folder folded in. Applied where the roster
    /// is known: the reader that asked git has no idea who is standing in its answer.
    func shared(by count: Int) -> WorkspaceProjection {
        rewriting(held: held.counting(count))
    }

    /// The same reading, with how Argo knows an Agent is in the folder folded in.
    func known(via provenance: SessionProvenance) -> WorkspaceProjection {
        rewriting(held: held.known(via: provenance))
    }

    private func rewriting(held: WorkspaceHolders) -> WorkspaceProjection {
        WorkspaceProjection(
            kind: kind,
            refs: Refs(branch: branch, baseRef: baseRef, headSha: headSha),
            drift: Drift(dirty: dirty, divergence: divergence),
            held: held,
        )
    }
}
