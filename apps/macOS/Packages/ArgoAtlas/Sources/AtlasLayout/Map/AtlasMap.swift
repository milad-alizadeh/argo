import Foundation

/// A repository, measured: the one file everything downstream of the Atlas reads (#1145).
///
/// Argo-owned, per-machine app data, generated whole and read on every open after — never
/// committed and never watched. `measuredAt` and `commit` are what a later ticket compares
/// against the repository to say how far behind the reading is; `commit` is optional because a
/// repository with no history still gets a map.
public struct AtlasMap: Equatable, Sendable {
    /// The shape this reader writes and the only one it reads. A Map file names it so the reader
    /// can say "from another version" rather than "corrupt", which are different instructions.
    public static let version = 1

    public let measuredAt: Date
    public let commit: String?
    public let root: AtlasPlate

    /// `measuredAt` is held to the whole second the file can spell.
    ///
    /// ISO 8601 as written here carries no fraction, so a generator stamping a Map with `Date()`
    /// would otherwise hold a value the file cannot keep: the Map read back would differ from the
    /// Map written, by up to a second, on the one field a later ticket reads for staleness.
    /// Truncating on the way in makes the type carry only what the file carries.
    public init(measuredAt: Date, commit: String?, root: AtlasPlate) {
        self.measuredAt = Date(
            timeIntervalSince1970: measuredAt.timeIntervalSince1970.rounded(.down),
        )
        self.commit = commit
        self.root = root
    }

    /// Every measure name any Plot in the Map carries, sorted.
    ///
    /// Sorted rather than in encounter order because a set walked in its own order is how a map
    /// comes out different on every launch, and everything that offers the reader a choice of
    /// measure reads this list.
    public var measureNames: [String] {
        var names: Set<String> = []
        for plot in root.plots {
            names.formUnion(plot.measures.keys)
        }
        return names.sorted()
    }

    /// Every Plot in the Map, in the order the file holds them.
    public var plots: [AtlasPlot] {
        root.plots
    }
}
