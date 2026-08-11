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

    /// The kept note's sentence. Under a minute it is worded rather than counted: a reader who
    /// stepped away for forty seconds is told their words were kept, not handed a stopwatch.
    static func kept(sinceMs: Int, nowMs: Int) -> Self {
        let seconds = max((nowMs - sinceMs) / 1000, 0)
        guard seconds >= 60 else { return .draftKept("Draft kept from a moment ago") }
        return .draftKept("Draft kept from \(AgePhrase.phrase(sinceMs: sinceMs, nowMs: nowMs))")
    }

    var detail: String {
        switch self {
        case let .refusal(detail), let .draftKept(detail): detail
        }
    }
}
