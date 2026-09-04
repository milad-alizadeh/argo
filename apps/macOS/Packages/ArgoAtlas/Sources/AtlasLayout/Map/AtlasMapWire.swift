import Foundation

/// The Map file exactly as it is written, before anything is checked (#1145).
///
/// Its own shape rather than `Codable` on `AtlasMap`, because the two differ in the one way that
/// matters: the file nests names and the value tree carries paths. Parsing the bytes into this,
/// then building the value tree from it, is the one place a path is derived — the boundary rule,
/// and the reason `AtlasPlot.path` cannot disagree with where the node sits.
/// The one field read before anything else: which shape the rest of the file is in.
struct AtlasVersionWire: Codable {
    let version: Int
}

struct AtlasMapWire: Codable {
    let version: Int
    let measuredAt: Date
    let commit: String?
    let root: AtlasPlateWire
    /// Optional rather than a second version of the format: a Map file written before couplings
    /// were counted is a valid measurement of a repository, and it reads as one nothing was
    /// paired in — the same reading a one-commit repository gets (#1149).
    let couplings: [AtlasCouplingWire]?

    /// The version is not a parameter. It is this reader's own shape, so a caller that could pass
    /// one could write a file claiming to be a shape it is not.
    init(
        measuredAt: Date,
        commit: String?,
        root: AtlasPlateWire,
        couplings: [AtlasCouplingWire],
    ) {
        self.version = AtlasMap.version
        self.measuredAt = measuredAt
        self.commit = commit
        self.root = root
        self.couplings = couplings
    }
}

/// One Coupling, its two ends given as POSITIONS in the Map's own Plot order rather than as paths.
///
/// The file already names every file once, in the nesting. This repository measures 2,705 files
/// and 18,402 couplings: 914 KB of the Map file as positions, against the 342 KB the rest of it
/// takes, and roughly 2.5 MB if each tie named its two paths in full.
struct AtlasCouplingWire: Codable {
    let first: Int
    let second: Int
    let strength: Double
}

/// The root of the file, and every Plate under it. Kindless: the root of a Map is always a Plate,
/// so a `kind` there would be a word that can only be read one way and can still be written wrong.
struct AtlasPlateWire: Codable {
    let name: String
    let children: [AtlasNodeWire]
}

/// One node under the root, discriminated in the file rather than by which key happens to be
/// present — an absent `measures` is a Plot that measured nothing, not a Plate.
struct AtlasNodeWire: Codable {
    enum Kind: String, Codable {
        case plot
        case plate
    }

    let kind: Kind
    let name: String
    let measures: [String: Double]?
    let children: [AtlasNodeWire]?
}
