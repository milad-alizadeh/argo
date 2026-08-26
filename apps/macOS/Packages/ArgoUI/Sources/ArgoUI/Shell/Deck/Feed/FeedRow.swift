/// One drawable line of a Session's reading: its place in the feed and the claim it makes.
struct FeedRow: Identifiable, Equatable, Sendable {
    /// What a row IS, which is what decides how it is drawn. Each kind carries its own payload
    /// rather than sharing one `text` field.
    enum Content: Equatable, Sendable {
        /// What someone asked for, verbatim, and whatever was pasted in with it. A steer typed
        /// mid-run is one of these too.
        case prompt(text: String, shots: [FeedShot])
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
        /// A skill the Session was handed, in the sequence it happened. See `FeedSkillLoad`.
        case skillLoaded(FeedSkillLoad)
        /// Something that happened to the reading rather than in it. See `FeedMark`.
        case mark(FeedMark)
        /// A stretch of the record nothing could parse. See `FeedUnreadable`.
        case unreadable(FeedUnreadable)

        /// Whether this row is a call the record has not answered yet — the one the ion crosses.
        /// Asked by the projection, which draws the working thread only where no row is lit.
        var isCallInFlight: Bool {
            traits.isCallInFlight
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
        content.traits.isCall
    }

    /// Whether this row is something somebody SAID — neither the work nor the punctuation around
    /// it. Asked by the render that shows the reading with the work taken out.
    var isProse: Bool {
        content.traits.isProse
    }

    /// Whether this row is something the AGENT said. Asked by the count on the way-back control.
    var isMessage: Bool {
        content.traits.isMessage
    }

    /// Whether this row is something the USER asked for. Asked by the accent wash that marks a
    /// just-sent Turn's echo.
    var isPrompt: Bool {
        content.traits.isPrompt
    }

    /// Whether this row has anything for the evidence panel to show.
    var opensEvidence: Bool {
        content.traits.opensEvidence
    }

    /// Whether this row is the working thread — the one row the reading measure does not hold, so
    /// its ion sweeps the zone's full width and exits at the minimap's seam.
    var isWorkingThread: Bool {
        content == .mark(.working)
    }
}
