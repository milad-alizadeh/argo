import CoreGraphics

/// The box a surface draws a picture in, which is the size the bytes are decoded to.
///
/// A gallery thumbnail and a lightbox are the same byte run at a hundredfold difference in pixels.
/// Decoding once at the lightbox's size and drawing it in the thumbnail's pays that difference for
/// the life of the window, which is what made a session viewer's memory grow without a ceiling
/// (#962).
enum MediaBox: Sendable {
    /// A fixed plate the picture is drawn in — the gallery's shot, the panel's column. Decoded to
    /// cover it at the display's scale, never finer. A ZERO side is one the surface does not
    /// bound: the panel fits a picture to its width and lets the height run down its scroll.
    case plate(CGSize)
    /// Every pixel the file has, for the one surface that shows them. Never held: the lightbox has
    /// one picture open at a time and lets it go when it closes.
    case full

    /// Whether a decode made for this box is dense enough to draw in `other`. A decode too coarse
    /// for the box it is handed to is drawn soft, so it is made again rather than reused.
    ///
    /// Componentwise for two plates, which is sound because `MediaDecode.longestSide` is monotone
    /// in both sides of the box: a plate no smaller in either can never be the coarser decode.
    func covers(_ other: MediaBox) -> Bool {
        switch (self, other) {
        case (.full, _): true
        case (.plate, .full): false
        case let (.plate(held), .plate(wanted)):
            held.width >= wanted.width && held.height >= wanted.height
        }
    }

    /// The smallest box covering both. Two plates of different shapes — the panel's 480-wide
    /// column and the gallery's 168 × 112 shot — cover neither from the other, and both file under
    /// the same bytes, so without this each miss overwrites the other's entry and a byte run shown
    /// in both surfaces re-decodes on every alternation.
    func union(_ other: MediaBox) -> MediaBox {
        switch (self, other) {
        case (.full, _), (_, .full): .full
        case let (.plate(one), .plate(two)):
            .plate(CGSize(
                width: max(one.width, two.width),
                height: max(one.height, two.height),
            ))
        }
    }

    /// Whether this is the lightbox's box — the one decode that is made off the main actor and
    /// never held, and so the only surface that needs a task at all.
    var isFull: Bool {
        if case .full = self {
            return true
        }
        return false
    }
}
