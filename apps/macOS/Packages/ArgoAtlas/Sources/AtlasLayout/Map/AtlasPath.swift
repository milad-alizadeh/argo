/// A Map path, read. One place rather than four: a Plot, a Plate and both of their placements in a
/// plan all answer what they are called, and four copies of one split is four chances to disagree
/// about a file called `a/b/`.
enum AtlasPath {
    /// What the node at a path is called on disk — the last component, and the whole path for a
    /// root that has none.
    static func name(of path: String) -> String {
        String(path.split(separator: "/").last ?? "")
    }
}
