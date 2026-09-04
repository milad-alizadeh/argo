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

    /// `strength` is held to three decimals, which is what the file keeps.
    ///
    /// The same reason `AtlasMap` truncates `measuredAt`: a value the file cannot spell back is a
    /// Map read that differs from the Map written. Three decimals separate 0.001 from nothing at
    /// all, which is finer than any band a reader is offered, and rounding this repository's
    /// 18,402 ties takes 105 KB off app data that is read on every open.
    public init(first: String, second: String, strength: Double) {
        self.first = first
        self.second = second
        self.strength = (strength * 1000).rounded() / 1000
    }
}
