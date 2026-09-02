import ArgoDesign
import Foundation

/// What a row of the reading stands for, and the ink it is drawn in (#382).
///
/// Each of the feed's own types answers with its own — `FeedAsk.ink`, `FeedCall.Ending.ink`,
/// `FeedMark.ink` — and both the row and the lane read that one value.
///
/// Every role must stay opaque: the lane applies its own alpha on top, and a translucent role would
/// be dimmed twice.
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
    /// Words the agent linked somewhere — the one accent the feed spends inside prose.
    case link
    /// A pipe table's grid. A container of cells, stroked the way the feed strokes it.
    case table
    /// A drawn diagram: its nodes as the boxes they are, its connectors as the lines they are.
    case diagram

    /// How a run of this ink is drawn, which is what keeps the map legible with the colour taken
    /// away — under Increased Contrast, and for a reader who cannot tell amber from the ramp.
    enum Shape: Equatable, Sendable {
        /// Held off both edges and filled. Everything the reading actually says.
        case bar
        /// Stroked rather than filled: a picture is a container, not content.
        case frame
        /// A hairline at the floor height, whatever the row is worth. The punctuation between Turns
        /// is a rule in the feed and stays one here.
        case rule
    }

    /// How a rect of this ink is drawn where the row does not say otherwise — see
    /// `MinimapRowRect.shape`, which a question's card uses to stroke its own border around filled
    /// words.
    var shape: Shape {
        switch self {
        case .prompt, .message, .thought, .command, .added, .removed, .failure, .unreadable,
             .link, .attention: .bar
        case .media, .table, .diagram: .frame
        case .boundary: .rule
        }
    }

    /// This ink where it says a STATE, and `nil` where it is only a rung. The feed colours a
    /// failure and a question waiting on somebody, and spells everything else as loudness — so a
    /// row asks here which of the two it has rather than testing the state a second time.
    func state(in palette: ArgoPalette) -> ArgoColor? {
        switch self {
        case .failure, .attention: role(in: palette)
        case .prompt, .message, .thought, .command, .added, .removed, .media, .boundary,
             .unreadable, .link, .table, .diagram: nil
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
        // The ink the feed gives the same words: a link is the accent, while a table's grid and a
        // diagram's figures are containers on the message's own rung.
        case .link: palette.interaction.accent
        case .table, .diagram: palette.text.secondary
        }
    }
}
