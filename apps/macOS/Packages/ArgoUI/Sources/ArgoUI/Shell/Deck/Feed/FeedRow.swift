/// One drawable line of a Session's reading.
///
/// A row is text and the claim the text makes, and nothing else. Timestamps, tiers and evidence
/// all belong to events this feed does not draw yet — a row carrying fields no renderer reads
/// would be this ticket deciding their shape for the tickets that own them.
struct FeedRow: Identifiable, Equatable, Sendable {
    /// What a row IS, which is what decides how it is drawn. Three today; each of the other event
    /// kinds joins this list with the ticket that draws it.
    enum Kind: Equatable, Sendable {
        /// What someone asked for. A steer typed mid-run is one of these too.
        case prompt
        /// What the agent said.
        case message
        /// What the agent reasoned. Never a message — see `FeedProjection`.
        case thought
    }

    /// The row's place in the feed.
    ///
    /// Position rather than the text: two identical messages are two rows, and a feed keyed by
    /// content would fuse them. Dense over the ROWS rather than over the events, so the kinds this
    /// feed ignores leave no hole for a list to animate across.
    let id: Int
    let kind: Kind
    /// Verbatim, as the transcript wrote it.
    let text: String
}
