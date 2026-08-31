import ArgoEngine

/// Where a picture came from, as the cockpit says it out loud — read by every surface that shows
/// an image: the evidence panel, the feed's gallery, the lightbox.
///
/// Five values over a three-valued honesty tier: the two that are not tiers are the ways there is
/// no picture to draw, each reachable as a state rather than discovered as a `nil` when a view was
/// about to draw. They are not the same thing and must not read as each other.
enum MediaProvenance: Equatable, Sendable {
    /// The transcript's OWN embedded bytes — what the agent actually looked at, and the one
    /// reading a later edit to the file cannot invalidate.
    case captured
    /// A re-read of the path now. The same filename, which after three renders in one turn is
    /// very often not the same picture.
    case current
    /// The companion plugin's own render, arriving over the convention channel. Not a capture of
    /// anything on a screen.
    case rendered
    /// There is no picture to show. Never a broken-image glyph — that would be the system claiming
    /// a failure to LOAD where what happened is that nothing usable was written down.
    case absent
    /// A picture WAS written down and can no longer be read: a transcript rewritten under the
    /// address it was addressed by, a file deleted since the call that showed it (`MediaBytes`).
    ///
    /// Its own state because the pixels stopped being retained (#989): with the bytes read where
    /// they are drawn, "gone since" became a thing that can happen, and saying "the record kept no
    /// image" about a record that kept one is the lie a reader cannot check.
    case unreadable

    /// `showing` is whether the bytes actually became an image, which is a different question from
    /// whether there were any: a record can carry bytes that do not decode, and a surface drawing
    /// an absence must not also be offering a click onto one.
    init(_ media: MediaEvidence, showing hasPicture: Bool) {
        guard hasPicture else {
            self = .absent
            return
        }
        self = switch media.tier {
        case .direct: .captured
        case .derived: .current
        case .convention: .rendered
        }
    }

    /// How the picture is FRAMED, which is what tells the four apart before a caption is read.
    enum Treatment: Equatable, Sendable {
        /// Run to its own edges, in a solid frame. What a screen capture looks like.
        case bleeding
        /// Run to its own edges, in the broken frame the shell uses for a weaker claim.
        case broken
        /// Inset on a plate. Drawn rather than captured off anything, and it must not read as a
        /// photograph of a screen.
        case mounted
    }

    var treatment: Treatment {
        switch self {
        case .captured: .bleeding
        case .rendered: .mounted
        case .current, .absent, .unreadable: .broken
        }
    }

    /// What a caption says about the picture above it. `nil` for an absence: the sentence goes
    /// where the picture would have been, not into a caption under a blank.
    var words: String? {
        switch self {
        case .captured: "as the agent saw it"
        case .current: "the file as it stands now"
        case .rendered: "reported by the plugin"
        case .absent, .unreadable: nil
        }
    }

    /// What a surface draws INSTEAD of a picture, which of the two things happened.
    var instead: String {
        self == .unreadable ? Self.gone : Self.absence
    }

    /// Nothing usable was ever written down.
    static let absence = "The record kept no image for this call"
    /// Something was, and it is gone.
    static let gone = "This image can no longer be read"

    /// Whether there is anything to show — and so whether anything can be opened. A picture that
    /// has gone is not a control either, however sure the record is that it existed.
    var showsPicture: Bool {
        self != .absent && self != .unreadable
    }
}
