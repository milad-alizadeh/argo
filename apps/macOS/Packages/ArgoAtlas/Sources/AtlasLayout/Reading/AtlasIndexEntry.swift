/// One line of the index beside the map: a file, said the way a list says it (#1155).
///
/// The name and the folder are held apart rather than as one path, because the row sets them
/// differently and for a reason: a basename is not an address — half a repository is called
/// `index.ts` — and the two need their own clip to survive a narrow rail.
public struct AtlasIndexEntry: Equatable, Sendable {
    /// The whole path, which is what the map is marked by and what a selection means.
    public let path: String
    /// What the file is called.
    public let name: String
    /// What holds it, or empty for a file at the root of the measurement.
    public let folder: String
    /// What the file measures on the channel the map is COLOURED by, or none where the
    /// measurement carries no such number for it.
    ///
    /// Optional rather than zero, for the reading panel's own reason: a file git never saw and a
    /// file measured at nothing are different facts, and a list that spelled both `0` would say
    /// the false one twice as often.
    public let value: Double?

    public init(path: String, name: String, folder: String, value: Double?) {
        self.path = path
        self.name = name
        self.folder = folder
        self.value = value
    }
}
