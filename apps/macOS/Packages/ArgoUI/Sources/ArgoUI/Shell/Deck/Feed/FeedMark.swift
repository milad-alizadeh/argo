import ArgoEngine

/// The punctuation of a reading: the things that happen BETWEEN what an agent said and did — rows
/// about the shape of the record itself rather than about the work. One kind rather than four
/// because they are drawn alike and a run of looking breaks at each of them.
enum FeedMark: Equatable, Sendable {
    /// History was condensed here. The resume chain stitches across it; the reading says so.
    case compacted
    /// A Turn ended, and which reason ended it. An unreadable reason arrives as `.unknown` and is
    /// drawn as the word `unknown`.
    case turnEnded(StopReason)
    /// What the Session has spent, as the record reported it.
    case spent(Usage)
    /// The work left here for a fresh Session, and where it went — see `FeedHandoff`. The feed's
    /// one
    /// row that is a way out of the reading rather than a part of it.
    case handedOff(FeedHandoff)
    /// A Turn somebody stopped (#541), read off the entry the CLI writes for it. The record files
    /// the sentence on the USER side and names no one: the composer's Stop and an `ESC` typed into
    /// the terminal are the same keystroke by the time it is written down.
    case interrupted
    /// A Permission the gate ran out of patience for and refused itself (#573). The only mark that
    /// reports an ACT rather than the shape of the record, which is why it alone takes attention
    /// ink.
    case permissionExpired(PermissionExpiry)
    /// A Turn in progress (`FeedWorking`). The one mark that is not about something that has
    /// already happened, which is also why it is the one that comes and goes: it stands at the foot
    /// of the reading while the wait lasts and is gone the moment the record answers.
    case working
}

extension FeedMark {
    /// What the mark says on screen, or `nil` where the rule alone says it. The stop reason is the
    /// HOST's word, carried verbatim: a reader comparing the feed with their terminal must find the
    /// same word in both.
    var words: String? {
        switch self {
        case .compacted: "compacted"
        // An ordinary end is punctuation and nothing else — a word on it would repeat, once per
        // turn, what the rule already says.
        case .turnEnded(.endTurn): nil
        // Every OTHER reason keeps its word: a turn cut off by a token ceiling or ended in a
        // refusal
        // is not the same event as one that finished.
        case let .turnEnded(reason): "turn ended · \(reason.rawValue)"
        case let .spent(usage): "session · \(FeedSpend.words(usage))"
        // One word where the record has five: the rule it is let into already says a turn ended
        // here, so `[Request interrupted by user]` would restate the feed's own punctuation.
        case .interrupted: "interrupted"
        // Named, rather than "handed off" alone: the destination's own title is what the roster
        // will
        // show the reader when they get there.
        case let .handedOff(handoff): "handed off to \(handoff.title)"
        // Both halves, unshortened: `denied` alone would credit a decision nobody made, and
        // `expired` alone would leave what became of the tool call unsaid (#573).
        case .permissionExpired: "Permission expired — denied, unanswered"
        // The only mark whose words are about the present tense, and the only one whose absence a
        // moment later is not a bug (`FeedWorking`).
        case .working: FeedWorking.words
        }
    }

    /// Where this mark leads, for the one kind that leads anywhere. `nil` for the rest: every other
    /// mark is a statement rather than a way out, and making them all pressable would offer a click
    /// that does nothing every turn.
    var handoff: FeedHandoff? {
        guard case let .handedOff(handoff) = self else { return nil }
        return handoff
    }

    /// What a screen reader is told the mark is — a rule with no words is a shape, and a shape does
    /// not carry.
    /// Switched exhaustively with no `default`, so a mark added to this enum has to say what it
    /// SOUNDS like rather than inheriting a fallback written for turn boundaries.
    var spoken: String {
        switch self {
        case .compacted, .turnEnded, .spent, .handedOff: words ?? "Turn ended"
        // A sentence rather than the caption: "interrupted" alone read out is an adjective with
        // nothing to attach to.
        case .interrupted: "The Turn was interrupted"
        // The tool is named here and nowhere else: on the rule it would push the sentence past the
        // column at any real width, and spoken it is the difference between "a Permission expired"
        // and knowing WHICH call went unanswered.
        case let .permissionExpired(expiry):
            "Permission for \(expiry.toolName) expired — denied, unanswered"
        // A sentence rather than the caption, for the reason the expiry gets one: "working…" read
        // out is a word and an ellipsis, and the ellipsis is where the whole meaning was.
        case .working: FeedWorking.spoken
        }
    }
}
