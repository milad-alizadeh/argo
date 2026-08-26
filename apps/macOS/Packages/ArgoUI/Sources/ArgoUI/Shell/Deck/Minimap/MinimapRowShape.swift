import Foundation

/// What a row is drawn as, held as the little the lane needs to lay it out again exactly as the
/// feed laid it out (#382). One of these is built for every row whenever the feed reshapes, so it
/// must stay cheap to make and cheap to compare; the rects are reported later, for the lane's band
/// alone.
///
/// Every case carries the WORDS rather than a count of characters, because every question the lane
/// asks about a row — how many lines, how wide each one, where a link landed — is a question about
/// glyphs, and only the words can answer it.
enum MinimapRowShape: Equatable, Sendable {
    /// Prose with the shape the agent gave it: its blocks, in the order they are drawn. Every prose
    /// row is one of these, a bare paragraph included — one path, so a heading cannot be reported
    /// at a paragraph's face by a second one.
    case composed(blocks: [MinimapProseBlock], ink: FeedInk)
    /// The prompt's words, in a bubble against the trailing edge, under however many pictures were
    /// pasted in with them. `isFolded` is the reader's own state: a folded prompt draws only its
    /// first `ArgoFeedRow.collapsedPromptLines`, so a lane that assumed either answer misreports
    /// every prompt in the other one — and one that assumed no pictures misreports every height.
    case bubble(text: String, shots: Int, isFolded: Bool)
    /// A row the feed says in a single line, as the pieces it says it in — a call's mark, its verb,
    /// what it named, and what it did in lines.
    case line(parts: [MinimapLinePart], ink: FeedInk)
    /// A run of pictures. The lane wraps that many frames across itself the way the row wraps that
    /// many thumbnails across the column, so a turn that rendered six shots reads as six shots.
    case shots(count: Int)
    /// A question, as the bordered card the feed draws it in — see `MinimapAskCard`.
    case card(MinimapAskCard)
    /// The whole row, at its full width and height — the punctuation between Turns, and the rules
    /// that read the same way.
    case whole(FeedInk)
}
