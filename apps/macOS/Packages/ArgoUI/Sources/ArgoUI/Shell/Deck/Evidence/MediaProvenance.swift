import ArgoEngine

/// Where a picture came from, as the cockpit says it out loud — read by every surface that shows
/// an image: the evidence panel, the feed's gallery, the lightbox.
///
/// Four values over a three-valued honesty tier: "the record kept no bytes" is a provenance too,
/// reachable as a state rather than discovered as a `nil` when a view was about to draw.
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
        case .current, .absent: .broken
        }
    }

    /// What a caption says about the picture above it. `nil` for an absence: the sentence goes
    /// where the picture would have been, not into a caption under a blank.
    var words: String? {
        switch self {
        case .captured: "as the agent saw it"
        case .current: "the file as it stands now"
        case .rendered: "reported by the plugin"
        case .absent: nil
        }
    }

    /// What a surface draws INSTEAD of a picture.
    static let absence = "The record kept no image for this call"

    /// Whether there is anything to show — and so whether anything can be opened.
    var showsPicture: Bool {
        self != .absent
    }
}
