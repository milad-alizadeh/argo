/// What is marked ON the map, as against what the map is (#1154, #1160).
///
/// The file the reader has open and the ties drawn over the picture, in one value. They travel
/// together because they are one reading and because the drawing joins them: a pinned file's own
/// ties are drawn whatever the switch says, so a map handed the ties without the focus would draw
/// the wrong half of what the reader asked for.
///
/// It is also what keeps `AtlasView`'s own initializer at the parameter cap, which is a gate
/// rather than a preference (`swift-boundaries.sh` edge 6) — and the grouping the gate asks for is
/// the one the palette already draws these in: `atlas.marks` is the family a cord's colour comes
/// from, and this is the same distinction one level up.
@MainActor
public struct AtlasMarks {
    /// The file the reader has open, and what a click on the map means.
    public let focus: AtlasFocus

    /// Every tie the drawn Map carries, and whether the whole-map reading was asked for.
    public let ties: AtlasTies

    public init(focus: AtlasFocus = .none, ties: AtlasTies = .none) {
        self.focus = focus
        self.ties = ties
    }

    /// Nothing open, nothing drawn over the picture, and a click that does nothing: the map as a
    /// picture rather than as a way in. Every preview and every specimen of the drawing alone
    /// takes this.
    ///
    /// Computed rather than stored, for `AtlasFocus.none`'s reason: a stored property's
    /// initializer is evaluated outside this type's own isolation, and a closure is not
    /// `Sendable`.
    public static var none: AtlasMarks {
        AtlasMarks()
    }
}
