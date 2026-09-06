/// One step of the trail down to where the reader is: a folder, and what it is called (#1156).
///
/// Not the Plate itself, which is the thing this names: a Plate carries everything standing on it,
/// however deep, so a trail of Plates would hand a strip that draws four words the whole repository
/// four times over. Both fields are read straight off the Plate (`AtlasMap.trail(to:)`), so the two
/// cannot come to disagree about a folder called `a/b/`.
public struct AtlasStep: Equatable, Sendable {
    /// The folder, from the Map's root down. The first step of a trail is the root itself.
    public let path: String

    /// What the folder is called on disk — the Plate's own `name`, which for a root is the whole of
    /// its path where that path has no separator in it.
    public let name: String

    public init(path: String, name: String) {
        self.path = path
        self.name = name
    }
}
