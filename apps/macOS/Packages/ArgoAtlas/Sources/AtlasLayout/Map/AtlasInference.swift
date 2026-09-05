/// The Domains a Map was partitioned into, and what the partition is worth (#1157).
///
/// The third kind of fact. Every Measure is measured and every Coupling is counted, but a Domain
/// is GUESSED, from the only two signals every repository has — what its files are called, and
/// what changes together in it. The literature that recovers architecture this way reports the
/// same technique scoring 36 on one system and 94 on another, and the tools that do it best have
/// eleven GitHub stars between them.
///
/// So the guess never travels without its own account of itself. A reader cannot reach a Domain
/// except through this value, and the two numbers beside them are the ones that say whether to
/// believe the picture: whether the repository settled on a grain of its own, and how often two
/// independent readings of it agree.
public struct AtlasInference: Equatable, Sendable {
    /// The Domains, largest first. Empty for a repository the inference placed nothing in, which
    /// is a real answer rather than a failure — a handful of files share no words and change
    /// together only because they arrived together.
    public let domains: [AtlasDomain]

    /// The resolution the partition was taken at: the knob that trades many small Domains against
    /// few large ones.
    public let resolution: Double

    /// Whether that resolution was CHOSEN or merely picked. True where turning the knob stopped
    /// moving files between Domains over a run of steps — the repository answering for itself
    /// about its own grain. False where no such run exists, which is a real answer and is stated
    /// as one rather than papered over: the Domains below are then one arbitrary cut of a
    /// repository that has no natural one.
    public let settled: Bool

    /// How far the blended reading agrees with a reading taken from the filenames alone: the Rand
    /// index over the file pairs both placed, 0 to 1. With no human answer key there is no
    /// accuracy to report, so the rate at which two independent signals agree stands in for one.
    /// Absent where there is nothing to compare — fewer than two files placed by either.
    public let agreement: Double?

    /// `agreement` is held to three decimals, which is what the file keeps.
    public init(
        domains: [AtlasDomain],
        resolution: Double,
        settled: Bool,
        agreement: Double?,
    ) {
        self.domains = domains
        self.resolution = (resolution * 1000).rounded() / 1000
        self.settled = settled
        self.agreement = agreement.map { ($0 * 1000).rounded() / 1000 }
    }

    /// The Domain a path belongs to, and `nil` for a path that belongs to nothing.
    public func domain(of path: String) -> AtlasDomain? {
        domains.first { $0.members.contains { $0.path == path } }
    }
}
