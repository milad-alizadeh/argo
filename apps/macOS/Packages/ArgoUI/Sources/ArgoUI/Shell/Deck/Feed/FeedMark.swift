import ArgoEngine

/// The punctuation of a reading: the things that happen BETWEEN what an agent said and did.
///
/// Not rows about the work — rows about the shape of the record itself. That is why they are one
/// kind rather than four: they are drawn alike, they carry the feed's only hairlines, and a run of
/// looking breaks at each of them for the same reason a paragraph does.
enum FeedMark: Equatable, Sendable {
    /// History was condensed here. The resume chain stitches across it; the reading says so.
    case compacted
    /// A Turn ended, and which reason ended it. An unreadable reason arrives as `.unknown` and is
    /// drawn as the word `unknown` — the turn is over, and why is not Argo's to invent.
    case turnEnded(StopReason)
    /// What the Session has spent, as the record reported it.
    case spent(Usage)
    /// The work left here for a fresh Session, and where it went. The feed's one row that is a way
    /// out of the reading rather than a part of it — see `FeedHandoff`.
    case handedOff(FeedHandoff)
    /// A Permission the gate ran out of patience for and refused itself (#573). A mark because it
    /// is drawn as one and is not something the agent said or did — but the only one that reports
    /// an ACT rather than the shape of the record, which is why it alone takes attention ink.
    case permissionExpired(PermissionExpiry)
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
        // Named, rather than "handed off" alone. The whole of what this row is for is the reader
        // knowing where to go next, and the destination's own title is what the roster will show
        // them when they get there.
        case let .handedOff(handoff): "handed off to \(handoff.title)"
        // The study's own sentence, unshortened. `denied` alone would credit a decision nobody
        // made, and `expired` alone would leave what became of the tool call unsaid — the row is
        // both halves or it is a worse row than silence (#573).
        case .permissionExpired: "Permission expired — denied, unanswered"
        }
    }

    /// Where this mark leads, for the one kind that leads anywhere. `nil` for the rest, which is
    /// what keeps a hairline a hairline: every other mark is a statement rather than a way out, and
    /// a renderer that made them all pressable would offer a click that does nothing every turn.
    var handoff: FeedHandoff? {
        guard case let .handedOff(handoff) = self else { return nil }
        return handoff
    }

    /// What a screen reader is told the mark is. A rule with no words is a shape, and a shape is
    /// exactly what does not carry — so the end a sighted reader takes from the hairline is spoken
    /// here rather than passed over in silence.
    /// Switched exhaustively with no `default`, so a mark added to this enum has to say what it
    /// SOUNDS like rather than inheriting a fallback written for turn boundaries.
    var spoken: String {
        switch self {
        case .compacted, .turnEnded, .spent, .handedOff: words ?? "Turn ended"
        // The tool is named here and nowhere else. On the rule it would be the one mark carrying a
        // proper noun and would push the sentence past the column at any real width; spoken, it is
        // the difference between "a Permission expired" and knowing WHICH call went unanswered.
        case let .permissionExpired(expiry):
            "Permission for \(expiry.toolName) expired — denied, unanswered"
        }
    }
}
