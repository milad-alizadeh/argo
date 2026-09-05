/// Two Plots that keep changing in the same commit, and how tightly (#1149).
///
/// The one coupling signal every repository has, and the only one that sees a dependency no
/// import declares. It is a relation between two files rather than a Measure on either: a file
/// that changes on every commit is coupled to the whole repository, which is a fact about that
/// file and never about a pair.
public struct AtlasCoupling: Equatable, Sendable {
    /// The two Plot paths. One pair is one Coupling and not two: the counting settles which end is
    /// which, so a pair cannot arrive twice under two orders.
    public let first: String
    public let second: String

    /// Jaccard: the commits that touched both over the commits that touched either, 0 to 1.
    public let strength: Double

    /// `strength` is held to what the file keeps, the same reason `AtlasMap` truncates
    /// `measuredAt`: a value the file cannot spell back is a Map read that differs from the Map
    /// written. The figure itself is `Double.heldByTheMapFile`.
    public init(first: String, second: String, strength: Double) {
        self.first = first
        self.second = second
        self.strength = strength.heldByTheMapFile
    }
}
