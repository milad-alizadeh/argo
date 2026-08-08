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
        /// A stretch of the record nothing could parse. See `FeedUnreadable`.
        case unreadable(FeedUnreadable)
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
    ///
    /// An unreadable line is neither, and answers `false`: it is not work the agent did, so a
    /// render of the call vocabulary that carried one would be showing a reading failure as a call.
    var isCall: Bool {
        switch content {
        case .call, .survey, .gallery: true
        // A question, a mark and an unreadable line are none of them: one is somebody being waited
        // on, one is the shape of the record and one is a hole in it, and all three want the full
        // step a piece of prose gets rather than the tighter one that welds a run of work together.
        case .prompt, .message, .thought, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row is something somebody SAID. Neither the work nor the punctuation around it
    /// — asked by the render that shows the reading with the work taken out, which wants the words
    /// and not the marks between them.
    ///
    /// An unreadable line is not prose either: nobody said it, which is the whole of what it
    /// reports.
    var isProse: Bool {
        switch content {
        case .prompt, .message, .thought: true
        case .call, .survey, .gallery, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row has anything for the evidence panel to show.
    ///
    /// Asked by the pointer and the keyboard alike, so it is one rule: a row that draws no
    /// disclosure marker must not become the open row when Return lands on it either.
    var opensEvidence: Bool {
        switch content {
        case let .call(call): call.disclosure == .available
        case let .survey(survey): survey.disclosure == .available
        case .prompt, .message, .thought, .gallery, .ask, .mark, .unreadable: false
        }
    }
}
