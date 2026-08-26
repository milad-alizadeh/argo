/// What a spawn is given beyond "start the agent": where to run, and what to open on.
///
/// Both absent by default, which is the plain New Session: the Project's own folder and a prompt
/// nobody has typed yet. A handoff fills both in, and that is the only difference between the two
/// spawns — the second half of #513 calls the SAME path #412 built rather than a parallel one.
public struct SessionSeed: Sendable, Equatable {
    /// The folder to run in, overriding the Project's. This is how a fresh Session inherits the
    /// Workspace of the one it continues — same folder, same branch, same derivations off it.
    public let cwd: String?
    /// The prompt the agent opens on. Argo owns no more of the fresh Session than this — after the
    /// first turn it is an agent like any other.
    public let opening: String?
    /// The rung the Session stands on (`CONTEXT.md` L2 · Autonomy, ADR-0025), and `nil` for the one
    /// the user last picked (#629). Optional rather than defaulted to `Code`, because a caller that
    /// names no rung and one that names the baseline are different asks and only the first defers.
    public let mode: SessionMode?
    /// The chain to CONTINUE rather than start. Absent is the plain New Session; present makes this
    /// the third caller of one spawn path (#10).
    public let resuming: SessionResumeTarget?

    public init(
        cwd: String? = nil,
        opening: String? = nil,
        mode: SessionMode? = nil,
        resuming: SessionResumeTarget? = nil,
    ) {
        self.cwd = cwd
        self.opening = opening
        self.mode = mode
        self.resuming = resuming
    }

    /// A New Session: the Project's folder, and nothing said yet.
    public static let unseeded = SessionSeed()
}

/// The chain a resume continues, under BOTH keys it is known by (#731).
///
/// A Session has two ids and they are not interchangeable: the roster and the ownership ledger key
/// it by transcript path, while `--resume` takes the chain's own uuid. Filing a claim under the
/// second is why a resumed Session was graded `orphaned` forever — grading asked with the first and
/// nothing matched. Held together so neither caller can name one without the other.
public struct SessionResumeTarget: Sendable, Equatable {
    /// What `--resume` is given: the CLI's own id for the chain's latest link.
    public let chainID: String
    /// What the roster carries this Session as, and what ownership is keyed by.
    public let sessionID: String

    public init(chainID: String, sessionID: String) {
        self.chainID = chainID
        self.sessionID = sessionID
    }
}
