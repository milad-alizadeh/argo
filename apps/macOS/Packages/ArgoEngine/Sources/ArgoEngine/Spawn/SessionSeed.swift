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

    public init(cwd: String? = nil, opening: String? = nil) {
        self.cwd = cwd
        self.opening = opening
    }

    /// A New Session: the Project's folder, and nothing said yet.
    public static let unseeded = SessionSeed()
}
