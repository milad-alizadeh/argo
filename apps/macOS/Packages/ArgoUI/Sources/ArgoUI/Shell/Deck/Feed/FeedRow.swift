/// One drawable line of a Session's reading: its place in the feed and the claim it makes.
struct FeedRow: Identifiable, Equatable, Sendable {
    /// What a row IS, which is what decides how it is drawn. Each kind carries its own payload
    /// rather than sharing one `text` field.
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

        /// Whether this row is a call the record has not answered yet — the one the ion crosses.
        /// Asked by the projection, which draws the working thread only where no row is lit.
        ///
        /// A folded run counts: `FeedCallRun` keeps the run pending while any call in it is, so a
        /// row standing for three edits is in flight exactly when its last edit is.
        var isCallInFlight: Bool {
            switch self {
            case let .call(call): call.ending == .pending
            // A survey and a gallery are counts rather than lines, and neither draws an ion. A
            // pending call folded into one is not a lit row, so the thread is what stands over it.
            case .prompt, .message, .thought, .survey, .gallery, .ask, .mark, .unreadable: false
            }
        }
    }

    /// The row's place in the feed — position, never the content: a feed keyed by what a row says
    /// would fuse two identical messages. Dense over the ROWS, so the kinds this feed ignores leave
    /// no hole for a list to animate across.
    let id: Int
    let content: Content

    /// Whether this row is a piece of work rather than a piece of prose. Asked by the feed's own
    /// spacing and by the render that shows the calls alone.
    var isCall: Bool {
        switch content {
        case .call, .survey, .gallery: true
        // A question, a mark and an unreadable line want the full step prose gets, not the tighter
        // one that welds a run of work together.
        case .prompt, .message, .thought, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row is something somebody SAID — neither the work nor the punctuation around
    /// it. Asked by the render that shows the reading with the work taken out.
    var isProse: Bool {
        switch content {
        case .prompt, .message, .thought: true
        case .call, .survey, .gallery, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row is something the AGENT said. Narrower than `isProse` — asked by the count
    /// on the way-back control. A thought is deliberately not one: a Turn's final message routinely
    /// contradicts its own reasoning, so counting both promises two things where the agent said
    /// one.
    var isMessage: Bool {
        switch content {
        case .message: true
        case .prompt, .thought, .call, .survey, .gallery, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row is something the USER asked for. Asked by the accent wash that marks a
    /// just-sent Turn's echo.
    var isPrompt: Bool {
        switch content {
        case .prompt: true
        case .message, .thought, .call, .survey, .gallery, .ask, .mark, .unreadable: false
        }
    }

    /// Whether this row has anything for the evidence panel to show. One rule for pointer and
    /// keyboard: a row that draws no disclosure marker must not open on Return either.
    var opensEvidence: Bool {
        switch content {
        case let .call(call): call.disclosure == .available
        case let .survey(survey): survey.disclosure == .available
        case .prompt, .message, .thought, .gallery, .ask, .mark, .unreadable: false
        }
    }
}
