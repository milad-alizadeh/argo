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
