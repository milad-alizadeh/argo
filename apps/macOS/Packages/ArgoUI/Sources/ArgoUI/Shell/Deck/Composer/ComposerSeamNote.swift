/// What the line above the vessel says, and when it says it.
///
/// Two notes, one seam. A restored draft is simply *there* — the seam does not offer to put it
/// back, it says it was kept and how long ago it was written, which is the fact a reader needs to
/// know whether they are looking at this morning's thought or last week's.
enum ComposerSeamNote: Equatable {
    /// Why the last send did not go, in the port's own words, with a retry (design decision 8).
    case refusal(String)
    /// A draft that survived leaving the Session, and the age of the words in it.
    case draftKept(String)
    /// Something Argo did to the draft that the reader did not — a drop the adapter cannot take
    /// (#540, design decision 9), or the clearing an interrupt leaves behind (#541). Its own case
    /// rather than a `refusal`, because nothing was sent and no unsent words are at risk: it
    /// reports rather than warns, and takes the quiet ink for saying so.
    case notice(String)

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
    static func note(for draft: ComposerDraft, enteredAtMs: Int) -> Self? {
        if let refusal = draft.refusal {
            return .refusal(refusal)
        }
        if let notice = draft.notice {
            return .notice(notice)
        }
        guard !draft.text.isEmpty, let editedAtMs = draft.editedAtMs, editedAtMs < enteredAtMs
        else { return nil }
        return kept(sinceMs: editedAtMs, nowMs: enteredAtMs)
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
        case let .refusal(detail), let .draftKept(detail), let .notice(detail): detail
        }
    }
}
