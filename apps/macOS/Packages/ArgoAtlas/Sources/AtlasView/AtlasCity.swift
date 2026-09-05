/// The boxes of one map, and the files their ids name (#1153).
///
/// The two travel together for one reason: an id read out of the target is worth nothing without
/// the roster the target was DRAWN with. A renderer that kept the boxes and let its caller look
/// the name up against whatever plan it happened to hold next would be back to the class of defect
/// the id target exists to remove — a pick resolved against something other than the picture.
struct AtlasCity {
    /// Every box, in the order they are painted.
    let volumes: [AtlasVolume]

    /// Every file the id target can name, in id order: id 1 is the first of these.
    let roster: [String]

    /// The file one id names, or nothing. 0 is the desktop, a plate, a rim or a shadow — every
    /// part of the map that is not a file — and an id past the roster is a target drawn from an
    /// older map than the one being asked, which is nothing rather than a guess (#1153's "a point
    /// on no box resolves to nothing, rather than to the nearest").
    func file(at id: UInt32) -> String? {
        guard id > 0, Int(id) <= roster.count else { return nil }
        return roster[Int(id) - 1]
    }

    static let empty = AtlasCity(volumes: [], roster: [])
}

/// What one pixel of the map answers: a file, or no file.
///
/// A type for one optional, because the reading it has to be told apart from is a SECOND absence.
/// `AtlasVolumeRenderer.pick(atPixel:)` returns `nil` for "no frame has landed yet, ask again", and
/// an `AtlasPick` whose `file` is `nil` for "there is no file there" — which a reader is owed, and
/// which #1153 spells as "a point on no box resolves to nothing, rather than to the nearest". A
/// bare `String??` would leave the two one keystroke apart at every call site.
struct AtlasPick {
    let file: String?
}
