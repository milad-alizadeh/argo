import ArgoEngine

/// One drawable line of a Session's reading: its place in the feed and the claim it makes.
package struct FeedRow: Identifiable, Equatable, Sendable {
    /// What a row IS, which is what decides how it is drawn. Each kind carries its own payload
    /// rather than sharing one `text` field.
    package enum Content: Equatable, Sendable {
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
        /// A Turn's work, as one line of counts. See `FeedWorkFold`.
        case work(FeedWork)
        /// A run of pictures, as one row of thumbnails. See `FeedGalleryFold`.
        case gallery(FeedGallery)
        /// A question put to somebody, waiting or settled. The feed's one attention state.
        case ask(FeedAsk)
        /// A skill the Session was handed, in the sequence it happened. See `FeedSkillLoad`.
        case skillLoaded(FeedSkillLoad)
        /// Something that happened to the reading rather than in it. See `FeedMark`.
        case mark(FeedMark)
        /// A wait Argo was holding, over — see `FeedWaitRow`. A row rather than a mark, and drawn
        /// as a CALL is rather than as a rule: a wait that ended is a thing that happened, which is
        /// what the reading already spends a call's shape on.
        case settledWait(SessionWaitSettled)
        /// A stretch of the record nothing could parse. See `FeedUnreadable`.
        case unreadable(FeedUnreadable)
    }

    /// The row's place in the feed — position, never the content: a feed keyed by what a row says
    /// would fuse two identical messages. Dense over the ROWS, so the kinds this feed ignores leave
    /// no hole for a list to animate across.
    package let id: Int
    package let content: Content

    /// What this row IS — every fact about it, answered in one place. Rebuilt on each access, so a
    /// reader wanting more than one fact takes it into a local first.
    package var kind: Content.Kind {
        content.kind
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(id: Int, content: Content) {
        self.id = id
        self.content = content
    }
}
