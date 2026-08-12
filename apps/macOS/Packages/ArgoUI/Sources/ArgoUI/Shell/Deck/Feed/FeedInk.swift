import Foundation

/// What a row of the reading stands for, and the ink it is drawn in (#382).
///
/// The FEED owns this, not the minimap, and each of the feed's own types answers with its own —
/// `FeedAsk.ink`, `FeedCall.ink`, `FeedMark.ink`. The row paints from it and the lane draws from
/// it, so there is no second table of colours to fall out of step with the first. That drift is
/// what put attention amber on a settled question in the lane while the row below it had already
/// gone quiet.
///
/// No hue is spent here that the rows do not spend: the text ramp for what was said, the two diff
/// inks for what a mutation did, and attention for the one row waiting on somebody. Every role is
/// opaque, because the lane's own alpha is applied on top and a translucent role would dim twice.
///
/// Colour is never the whole answer. D25's map may not depend on it, so the run's SHAPE carries the
/// class too — see `Shape` here, and the spans the projection gives each kind.
enum FeedInk: Equatable, Sendable, CaseIterable {
    /// What someone asked for.
    case prompt
    /// What the agent said.
    case message
    /// What it reasoned — the quietest prose, as the feed draws it.
    case thought
    /// A call. One flat slab rather than ragged lines, because a call is one sentence however wide
    /// the column gets, and that shape is what separates it from the prose around it.
    case command
    /// The added half of a mutation.
    case added
    /// The removed half.
    case removed
    /// A run of pictures. Drawn as a frame, never as a fill.
    case media
    /// A call that failed. The feed draws the whole line in this ink, so the lane does too — a run
    /// of red rows in the reading that showed as quiet grey here would be the lane lying about the
    /// one thing a reader scans an overview for.
    case failure
    /// A question waiting on somebody — the feed's one attention state.
    case attention
    /// The punctuation between Turns, drawn as the feed draws it: a rule.
    case boundary
    /// A stretch of the record nothing could parse.
    case unreadable

    /// How a run of this ink is drawn, which is what keeps the map legible with the colour taken
    /// away — under Increased Contrast, and for a reader who cannot tell amber from the ramp.
    enum Shape: Equatable, Sendable {
        /// Held off both edges and filled. Everything the reading actually says.
        case bar
        /// Stroked rather than filled: a picture is a container, not content.
        case frame
        /// A hairline at the floor height, whatever the row is worth. The punctuation between
        /// Turns is a rule in the feed and stays one here.
        case rule
        /// The whole width of the lane, inset and all. Nothing else takes this shape, which is how
        /// a needs-you row is found without reading a colour.
        case band
    }

    var shape: Shape {
        switch self {
        case .prompt, .message, .thought, .command, .added, .removed, .failure, .unreadable: .bar
        case .media: .frame
        case .attention: .band
        case .boundary: .rule
        }
    }

    /// The role the feed reads this kind in, at the lane's own alpha. Taken off the palette rather
    /// than named, so a second appearance moves the lane with everything else.
    func color(in palette: ArgoPalette) -> ArgoColor {
        role(in: palette).opacity(ArgoMinimapLane.runOpacity)
    }

    /// This ink where it says a STATE, and `nil` where it is only a rung. The feed colours a
    /// failure and a question waiting on somebody, and spells everything else as loudness — so a
    /// row asks here which of the two it has rather than testing the state a second time.
    func state(in palette: ArgoPalette) -> ArgoColor? {
        switch self {
        case .failure, .attention: role(in: palette)
        case .prompt, .message, .thought, .command, .added, .removed, .media, .boundary,
             .unreadable: nil
        }
    }

    /// The role at full strength, for the rows themselves. The lane takes `color(in:)` instead.
    func role(in palette: ArgoPalette) -> ArgoColor {
        switch self {
        case .prompt: palette.text.primary
        // A message, a call and a picture frame share one rung. A rung is a loudness and not a
        // meaning (`rules/design-system.md`); what tells them apart is that one is ragged lines,
        // one is a slab, and one is a frame.
        case .message, .command, .media: palette.text.secondary
        case .thought, .unreadable: palette.text.tertiary
        case .added: palette.diff.added
        case .removed: palette.diff.removed
        case .failure: palette.state.failure
        case .attention: palette.state.attention
        case .boundary: palette.text.disabled
        }
    }
}
