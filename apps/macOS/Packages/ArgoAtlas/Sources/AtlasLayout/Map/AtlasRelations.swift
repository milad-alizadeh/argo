/// What a Map says about Plots TOGETHER, as against what its Measures say about each one alone.
///
/// One value rather than two fields, because it is one reading of one repository: the Domains are
/// inferred partly FROM the Couplings, so a Map holding one without the other would be a Map whose
/// two halves were read off a repository committed to in between. Grouping by the reading each
/// fact comes from is what the four-parameter cap asks for (`apps/macOS/.swiftlint.yml`); the cap
/// is not the reason, because width moved into a value type is width hidden rather than removed.
public struct AtlasRelations: Equatable, Sendable {
    /// Which files keep changing together, counted from git alone (#1149). Empty for a repository
    /// whose history cannot pair anything — one commit, or none.
    public let couplings: [AtlasCoupling]

    /// Which files are about the same subject, inferred rather than measured (#1157). Absent for
    /// a Map written before anything was inferred, which is a valid measurement that guessed
    /// nothing — not the same reading as a repository the inference placed no file in.
    public let inference: AtlasInference?

    /// A Map that read nothing across its files: the reading a repository of one commit gets, and
    /// the reading every Map file written before either of these was counted comes back as.
    public static let none = AtlasRelations()

    public init(couplings: [AtlasCoupling] = [], inference: AtlasInference? = nil) {
        self.couplings = couplings
        self.inference = inference
    }

    /// The same reading over fewer Plots — what every narrowing of a Map has to do to what it says
    /// across them. Hiding test files (#1161) and descending into a folder (#1156) are two ways of
    /// asking for it, and one rule rather than two, because a Coupling dropped by one and kept by
    /// the other would be a Map that read differently depending on how it got there.
    ///
    /// A Coupling survives only where BOTH ends did: it is a fact about a pair, and a pair with one
    /// end outside the Map is not a weaker fact, it is a fact about something the Map no longer
    /// holds.
    func keeping(_ paths: Set<String>) -> AtlasRelations {
        AtlasRelations(
            couplings: couplings.filter { paths.contains($0.first) && paths.contains($0.second) },
            inference: inference?.keeping(paths),
        )
    }
}

private extension AtlasInference {
    /// The same inference over fewer files. The Domains are NOT re-inferred — that needs the
    /// history and the whole file list, which is the generator's reading and not this one — so a
    /// Domain here is what it was, minus the files that left, and a Domain the narrowing emptied
    /// is gone. The two numbers stand as taken: they describe the partition the generator settled
    /// on, and restating them against a subset would be inventing a second inference.
    ///
    /// A survivor keeps its RANK, which is why the rank is carried rather than counted: this drops
    /// the Domains that lost every member, so a rank read off the array afterwards would shift
    /// every Domain past the gap — and the map would repaint itself the moment a reader hid the
    /// test files (#1158).
    func keeping(_ paths: Set<String>) -> AtlasInference {
        AtlasInference(
            domains: domains.compactMap { domain in
                let members = domain.members.filter { paths.contains($0.path) }
                guard !members.isEmpty else { return nil }
                return AtlasDomain(
                    name: domain.name,
                    tokens: domain.tokens,
                    members: members,
                    rank: domain.rank,
                )
            },
            resolution: resolution,
            settled: settled,
            agreement: agreement,
        )
    }
}
