/// The boxes of one map, and what their ids name (#1153; folders too since #1156).
///
/// The two travel together for one reason: an id read out of the target is worth nothing without
/// the roster the target was DRAWN with. A renderer that kept the boxes and let its caller look
/// the name up against whatever plan it happened to hold next would be back to the class of defect
/// the id target exists to remove — a pick resolved against something other than the picture.
struct AtlasCity {
    /// Every box, in the order they are painted.
    let volumes: [AtlasVolume]

    /// Everything the id target can name, in id order: id 1 is the first of these. The folders
    /// first and the files after, because that is the order the boxes themselves are built in and
    /// one walk decides both.
    let roster: [AtlasTarget]

    /// What one id names, or nothing. 0 is the desktop and a cast shadow — the parts of the map
    /// that are neither a file nor a folder — and an id past the roster is a target drawn from an
    /// older map than the one being asked, which is nothing rather than a guess (#1153's "a point
    /// on no box resolves to nothing, rather than to the nearest").
    func target(at id: UInt32) -> AtlasTarget? {
        guard id > 0, Int(id) <= roster.count else { return nil }
        return roster[Int(id) - 1]
    }

    /// The FILE one id names, and nothing where it names a folder. What the hover reads: the strip
    /// over the map names the file under the pointer, and a folder is not one.
    func file(at id: UInt32) -> String? {
        target(at: id)?.file
    }

    static let empty = AtlasCity(volumes: [], roster: [])
}

/// What one pixel of the map answers: a file, a folder, or nothing there at all.
///
/// A type for one optional, because the reading it has to be told apart from is a SECOND absence.
/// `AtlasVolumeRenderer.pick(atPixel:)` returns `nil` for "no frame has landed yet, ask again", and
/// an `AtlasPick` whose `target` is `nil` for "there is nothing there" — which a reader is owed,
/// and which #1153 spells as "a point on no box resolves to nothing, rather than to the nearest".
/// A bare `AtlasTarget??` would leave the two one keystroke apart at every call site.
struct AtlasPick {
    let target: AtlasTarget?

    /// The file picked, and nothing where it was a folder — what the hover asks, which has no use
    /// for a folder it cannot say in a strip built to name files.
    var file: String? {
        target?.file
    }
}
