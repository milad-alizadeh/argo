/// One drawable line of a Session's reading.
///
/// A row is its place in the feed and the claim it makes, and nothing else. Timestamps, tiers and
/// evidence all belong to events this feed does not draw yet — a row carrying fields no renderer
/// reads would be this ticket deciding their shape for the tickets that own them.
struct FeedRow: Identifiable, Equatable, Sendable {
    /// What a row IS, which is what decides how it is drawn. Each kind carries its own payload
    /// rather than sharing one `text` field: a call is not a block of prose, and a row shaped to
    /// hold both would leave every renderer to work out which half applied to it.
    enum Content: Equatable, Sendable {
        /// What someone asked for, verbatim. A steer typed mid-run is one of these too.
        case prompt(String)
        /// What the agent said, verbatim.
        case message(String)
        /// What the agent reasoned, verbatim. Never a message — see `FeedProjection`.
        case thought(String)
        /// What the agent did, as one sentence-shaped line.
        case call(FeedCall)
        /// A run of looking, as one line of counts. See `FeedSurveyFold`.
        case survey(FeedSurvey)
        /// A run of pictures, as one row of thumbnails. See `FeedGalleryFold`.
        case gallery(FeedGallery)
        /// A question put to somebody, waiting or settled. The feed's one attention state.
        case ask(FeedAsk)
        /// Something that happened to the reading rather than in it. See `FeedMark`.
        case mark(FeedMark)
    }

    /// The row's place in the feed.
    ///
    /// Position rather than the content: two identical messages are two rows, and a feed keyed by
    /// what a row says would fuse them. Dense over the ROWS rather than over the events, so the
    /// kinds this feed ignores leave no hole for a list to animate across.
    let id: Int
    let content: Content

    /// Whether this row is a piece of work rather than a piece of prose. Two surfaces ask it —
    /// the feed's own spacing, and the render that shows the calls alone.
    var isCall: Bool {
        switch content {
        case .call, .survey, .gallery: true
        // A question and a mark are neither: one is somebody being waited on and the other is the
        // shape of the record, and both want the full step a piece of prose gets rather than the
        // tighter one that welds a run of work together.
        case .prompt, .message, .thought, .ask, .mark: false
        }
    }

    /// Whether this row is something somebody SAID. Neither the work nor the punctuation around it
    /// — asked by the render that shows the reading with the work taken out, which wants the words
    /// and not the marks between them.
    var isProse: Bool {
        switch content {
        case .prompt, .message, .thought: true
        case .call, .survey, .gallery, .ask, .mark: false
        }
    }
}
