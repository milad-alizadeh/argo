/// One file of a repository, measured (#1145).
///
/// The measure bag is OPEN and keyed by the generator's own words. Which measures exist is a
/// property of the repository and the languages in it, not of Argo: a Plot that declared five
/// named properties would be wrong on the first repository that measured six.
public struct AtlasPlot: Equatable, Sendable {
    /// Where the file sits, from the Map's root down. Stored rather than walked back up, because
    /// this is the string the reader searches and the string a later ticket resolves to a file on
    /// disk; the decoder builds it once from the nesting, so the two cannot disagree.
    public let path: String

    /// Every number measured about this file, by the generator's name for it.
    public let measures: [String: Double]

    public init(path: String, measures: [String: Double]) {
        self.path = path
        self.measures = measures
    }

    /// What the file is called on disk.
    public var name: String {
        String(path.split(separator: "/").last ?? "")
    }
}
