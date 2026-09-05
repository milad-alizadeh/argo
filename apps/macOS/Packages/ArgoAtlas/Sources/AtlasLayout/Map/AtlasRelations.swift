/// What a Map says about Plots TOGETHER, as against what its Measures say about each one alone.
///
/// One value rather than two fields, because it is one reading of one repository: the Domains are
/// inferred partly FROM the Couplings, so a Map holding one without the other would be a Map whose
/// two halves were read off a repository committed to in between. Grouping by the reading each
/// fact comes from is what `docs/agents/module-boundaries.md` asks for at the parameter cap; the
/// cap is not the reason, because width moved into a value type is width hidden rather than
/// removed.
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
}
