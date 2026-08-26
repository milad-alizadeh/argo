extension FeedRow.Content {
    /// What a row IS, answered for every kind in one place. The feed's spacing, its two filtered
    /// renders, the accent on a just-sent echo, the working thread and the evidence panel each
    /// read one of these.
    struct Traits: Equatable, Sendable {
        /// A piece of work rather than a piece of prose. The feed welds a run of these together
        /// with a tighter step than prose gets.
        var isCall = false
        /// Something somebody SAID — neither the work nor the punctuation around it.
        var isProse = false
        /// Something the AGENT said. Narrower than `isProse`: a Turn's final message routinely
        /// contradicts its own reasoning, so counting a thought would promise two answers where
        /// the agent gave one.
        var isMessage = false
        /// Something the USER asked for.
        var isPrompt = false
        /// A call the record has not answered yet — the one the ion crosses. A folded run is not
        /// one even while a call inside it is pending: the row is a count rather than a line, and
        /// the working thread is what stands over it.
        var isCallInFlight = false
        /// Whether there is anything for the evidence panel to show. One rule for pointer and
        /// keyboard, so a row that draws no disclosure marker does not open on Return either.
        var opensEvidence = false
    }

    /// The one exhaustive `switch` over the kinds. No `default`, so a tenth kind fails this build
    /// rather than quietly answering `false` to all six.
    var traits: Traits {
        switch self {
        case .prompt: Traits(isProse: true, isPrompt: true)
        case .message: Traits(isProse: true, isMessage: true)
        case .thought: Traits(isProse: true)
        case let .call(call):
            Traits(
                isCall: true,
                isCallInFlight: call.ending == .pending,
                opensEvidence: call.disclosure == .available,
            )
        case let .survey(survey):
            Traits(isCall: true, opensEvidence: survey.disclosure == .available)
        // A gallery opens no panel — what a shot produced IS the shot, so the click goes to the
        // picture.
        case .gallery: Traits(isCall: true)
        // A marker is punctuation too, and it opens onto whatever Argo could read behind it — the
        // SKILL.md body, or the sentence saying why there is none.
        case let .skillLoaded(skill): Traits(opensEvidence: skill.opened != nil)
        // Punctuation: a question, a mark and an unreadable line each take the full step prose
        // gets without being any of these things.
        case .ask, .mark, .unreadable: Traits()
        }
    }

    /// Whether a Turn ends at this row. The feed's own punctuation and nothing else: the stop
    /// reason the host reported, and the interruption that stands in for one.
    ///
    /// Not one of the traits above because it is a fact about the READING rather than about the row
    /// — the overview lane's blocks and the feed's Copy turn are both cut by it (`TurnExtents`).
    ///
    /// Switched with no `default`, so a mark added to the feed has to say whether it closes a Turn
    /// rather than inheriting an answer written for the ones that exist today.
    var endsTurn: Bool {
        guard case let .mark(mark) = self else { return false }
        switch mark {
        case .turnEnded, .interrupted: return true
        case .compacted, .spent, .handedOff, .permissionExpired, .working: return false
        }
    }

    /// What the panel shows for this row, resolved against the row rather than remembered — a live
    /// transcript grows under an open panel.
    var opened: FeedEvidence? {
        switch self {
        case let .call(call): call.opened
        case let .survey(survey): survey.opened
        case let .skillLoaded(skill): skill.opened
        case .prompt, .message, .thought, .gallery, .ask, .mark, .unreadable: nil
        }
    }
}
