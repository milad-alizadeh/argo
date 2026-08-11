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
    /// The rung the Session stands on (`CONTEXT.md` L2 · Autonomy, ADR-0025). `Code` by default,
    /// which is the baseline the ladder is built around: ungated tools inside the Workspace should
    /// not pay a Permission round trip.
    public let mode: SessionMode

    public init(cwd: String? = nil, opening: String? = nil, mode: SessionMode = .code) {
        self.cwd = cwd
        self.opening = opening
        self.mode = mode
    }

    /// A New Session: the Project's folder, and nothing said yet.
    public static let unseeded = SessionSeed()
}
