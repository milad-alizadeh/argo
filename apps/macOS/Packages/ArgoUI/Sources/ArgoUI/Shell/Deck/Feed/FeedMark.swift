import ArgoEngine

/// The punctuation of a reading: the three things that happen BETWEEN what an agent said and did.
///
/// Not rows about the work — rows about the shape of the record itself. That is why they are one
/// kind rather than three: they are drawn alike, they carry the feed's only hairlines, and a run of
/// looking breaks at each of them for the same reason a paragraph does.
enum FeedMark: Equatable, Sendable {
    /// History was condensed here. The resume chain stitches across it; the reading says so.
    case compacted
    /// A Turn ended, and which reason ended it. An unreadable reason arrives as `.unknown` and is
    /// drawn as the word `unknown` — the turn is over, and why is not Argo's to invent.
    case turnEnded(StopReason)
    /// What the Session has spent, as the record reported it.
    case spent(Usage)
}

extension FeedMark {
    /// What the mark says on screen, in the record's own words — or `nil` where the rule alone says
    /// it. The stop reason is the HOST's word, carried verbatim rather than translated into a
    /// friendlier one: a reader comparing the feed with their terminal must find the same word in
    /// both.
    var words: String? {
        switch self {
        case .compacted: "compacted"
        // An ordinary end is punctuation and nothing else. It closes every turn in the reading, so
        // a word on it is the same word once per turn all the way down — and the rule already says
        // the thing it would say, which is that the reading changes shape here.
        case .turnEnded(.endTurn): nil
        // Every OTHER reason keeps its word. A turn cut off by a token ceiling or ended in a
        // refusal is not the same event as one that finished, and which it was is the part a reader
        // cannot get anywhere else.
        case let .turnEnded(reason): "turn ended · \(reason.rawValue)"
        case let .spent(usage): "session · \(FeedSpend.words(usage))"
        }
    }

    /// What a screen reader is told the mark is. A rule with no words is a shape, and a shape is
    /// exactly what does not carry — so the end a sighted reader takes from the hairline is spoken
    /// here rather than passed over in silence.
    var spoken: String {
        words ?? "Turn ended"
    }
}
