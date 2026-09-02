import ArgoEngine

/// What the line above the vessel says, and when it says it.
///
/// Two notes, one seam. A restored draft is simply *there* — the seam does not offer to put it
/// back, it says it was kept and how long ago it was written, which is the fact a reader needs to
/// know whether they are looking at this morning's thought or last week's.
enum ComposerSeamNote: Equatable {
    /// Why the last send did not go, in the port's own words, with a retry (design decision 8).
    case refusal(ComposerSeamLine)
    /// A draft that survived leaving the Session, and the age of the words in it.
    case draftKept(String)
    /// Something Argo did to the draft that the reader did not — a drop the adapter cannot take
    /// (#540, design decision 9), or the clearing an interrupt leaves behind (#541). Its own case
    /// rather than a `refusal`, because nothing was sent and no unsent words are at risk: it
    /// reports rather than warns, and takes the quiet ink for saying so.
    case notice(ComposerSeamLine)

    /// Which of the three is up, for one draft read at one moment — the seam is ONE line, so the
    /// order is the whole of what this decides.
    ///
    /// A refusal outranks everything: it is a thing that went wrong with a send, and the message
    /// it stands over is still unsent. A notice comes next, because it answers something that has
    /// just happened to the draft. The kept note is last and quietest — housekeeping about
    /// words the reader left behind, which holds only until their own edit stamps later than the
    /// moment they arrived.
    ///
    /// Here rather than in the vessel so the order is a claim a test can make. A precedence living
    /// in a `private var` on a View is one only a screenshot can check.
    static func note(
        for draft: ComposerDraft,
        enteredAtMs: Int,
        modeDidNotTake: SessionMode? = nil,
    )
        -> Self? {
        if let refusal = draft.refusal {
            return .refusal(ComposerSeamLine(refusal, output: draft.refusalOutput))
        }
        // Ahead of the draft's own notice, and a notice rather than a refusal: nothing was sent and
        // no words are at risk, but the control the reader is looking at has just moved on its own
        // and this is the only line that says why (#629).
        if let modeDidNotTake {
            return .notice(ComposerSeamLine(didNotTake(modeDidNotTake)))
        }
        if let notice = draft.notice {
            return .notice(ComposerSeamLine(notice, output: draft.noticeOutput))
        }
        guard !draft.text.isEmpty, let editedAtMs = draft.editedAtMs, editedAtMs < enteredAtMs
        else { return nil }
        return kept(sinceMs: editedAtMs, nowMs: enteredAtMs)
    }

    /// What the seam says about a rung that did not land. It names the rung that was asked for and
    /// not the one the Session is on, because the picker beside it already says that one.
    static func didNotTake(_ mode: SessionMode) -> String {
        "\(mode.label) did not take. The Session is still on the rung shown."
    }

    /// The kept note's sentence. Under a minute it is worded rather than counted: a reader who
    /// stepped away for forty seconds is told their words were kept, not handed a stopwatch.
    static func kept(sinceMs: Int, nowMs: Int) -> Self {
        let seconds = max((nowMs - sinceMs) / 1000, 0)
        guard seconds >= 60 else { return .draftKept("Draft kept from a moment ago") }
        return .draftKept("Draft kept from \(AgePhrase.phrase(sinceMs: sinceMs, nowMs: nowMs))")
    }

    var detail: String {
        switch self {
        case let .refusal(line), let .notice(line): line.detail
        case let .draftKept(detail): detail
        }
    }

    /// What the seam's gesture opens (§5), and `nil` where the line IS the whole of it. A kept
    /// draft never has one: it is housekeeping Argo worded itself, and no port was asked anything.
    var output: RawOutput? {
        switch self {
        case let .refusal(line), let .notice(line): line.output
        case .draftKept: nil
        }
    }
}
