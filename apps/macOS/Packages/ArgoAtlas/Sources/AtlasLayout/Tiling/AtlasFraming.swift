import CoreGraphics

/// What a Plate spends on being readable as a folder: the ring around what stands on it, and the
/// strip its name is drawn in.
///
/// `MermaidMeasure`'s sibling, and deliberately NOT a reader of `ArgoDesign`: this half of the
/// package depends on no contract, because the numbers here are the tiling's own arithmetic rather
/// than the rhythm a document is set on. What a plate is PAINTED in is a token, spent in
/// `AtlasView`. Named for framing rather than measuring, because Measure is taken: in this package
/// it is one named number about a Plot (`docs/domain/atlas.md`).
enum AtlasFraming {
    /// The ring a Plate keeps around what stands on it, so a file at the edge of one folder does
    /// not touch a file at the edge of the next.
    static let plateInset: CGFloat = 2
    /// The strip along the top of a Plate that its name is drawn in.
    static let plateHeader: CGFloat = 8

    /// The most of its own shorter side a Plate may spend on its frame.
    ///
    /// A cap and not a taste: the fixture nests eleven levels deep, and eleven unclamped frames
    /// take 110 points off a 360-point map — which is how the deep half of a tree stops being
    /// drawn. Past this share the frame shrinks with the plate and the children keep the room.
    static let frameShare: CGFloat = 0.25

    /// The ground a Plate's children are tiled into: the plate less its name strip and its ring.
    ///
    /// The two shrink TOGETHER, by one factor, rather than each being capped on its own. Capped
    /// separately they meet at the cap on a small plate, and a header equal to the ring is a plate
    /// with no name strip at all — which is exactly the deep, crowded plate that most needs one.
    static func interior(of rect: CGRect) -> CGRect {
        let cap = min(rect.width, rect.height) * frameShare
        let shrink = min(1, cap / plateHeader)
        let inset = plateInset * shrink
        let header = plateHeader * shrink
        return CGRect(
            x: rect.minX + inset,
            y: rect.minY + header,
            width: max(rect.width - inset * 2, 0),
            height: max(rect.height - header - inset, 0),
        )
    }
}
