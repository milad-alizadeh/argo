/// What the reader has open on the map, and what to do when they click (#1154).
///
/// A value and its write, rather than a binding: what is open is held by the room — the reading is
/// drawn in a column of its own, and both have to be looking at one file — and closing it is a
/// decision the map cannot make, because the map holds nothing to toggle against.
///
/// The pair travels together for `AtlasSwitch`'s reason: separately they are two parameters that
/// mean nothing apart, and a map handed one without the other either marks a file nothing can
/// close or takes clicks that mark nothing.
@MainActor
public struct AtlasFocus {
    /// The file the reader has open, or none.
    public let open: String?

    /// What the reader clicked, or nothing where they clicked the ground — which is an answer of
    /// its own, and one the caller is owed: clicking the ground is one of the three ways out of a
    /// reading.
    public let clicked: (String?) -> Void

    public init(open: String?, clicked: @escaping (String?) -> Void) {
        self.open = open
        self.clicked = clicked
    }

    /// Nothing open, and a click that does nothing: the map as a picture rather than as a way in.
    /// Every preview and every specimen of the drawing alone takes this.
    ///
    /// Computed rather than stored, for `AtlasMapChoice.inert`'s reason: a stored property's
    /// initializer is evaluated outside this type's own isolation, and a closure is not
    /// `Sendable`.
    public static var none: AtlasFocus {
        AtlasFocus(open: nil) { _ in }
    }
}
