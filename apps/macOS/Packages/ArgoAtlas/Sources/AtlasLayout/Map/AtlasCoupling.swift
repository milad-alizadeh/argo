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

    public init(first: String, second: String, strength: Double) {
        self.first = first
        self.second = second
        self.strength = strength
    }

    /// The other end, for a Plot at one end of it. `nil` for a path this Coupling does not join,
    /// which is what lets a reading collect one file's neighbours by asking every Coupling.
    public func partner(of path: String) -> String? {
        switch path {
        case first: second
        case second: first
        default: nil
        }
    }
}
