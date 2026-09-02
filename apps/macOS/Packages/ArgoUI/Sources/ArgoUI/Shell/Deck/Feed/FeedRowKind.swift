extension FeedRow.Content {
    /// What a row IS, answered for every kind in one place. The feed's spacing, its two filtered
    /// renders, the accent on a just-sent echo, the working thread, the evidence panel, the Turn
    /// punctuation, the lightbox and what a press on the row does each read one of these.
    package struct Kind: Equatable, Sendable {
        /// What a press on the row does — Return, Space and a click alike, since the row IS the
        /// control.
        enum Activation: Equatable, Sendable {
            /// Toggle the row's own fold.
            case fold
            /// Open the evidence panel on this row — or close it, where this row is already open.
            case openEvidence
            /// Open a picture full size.
            case light(FeedShot)
            /// Nothing to open, so the key falls through to the feed, which is where scrolling
            /// lives. Swallowing it on an inert row takes it away from the feed.
            case inert

            /// A press that opens the first picture there is anything behind. A row whose pictures
            /// are all absences is `.inert`, so the key falls through rather than lighting nothing.
            static func light(oneOf shots: [FeedShot]) -> Self {
                shots.first(where: \.isOpenable).map(light) ?? .inert
            }
        }

        /// A piece of work rather than a piece of prose. The feed welds a run of these together
        /// with a tighter step than prose gets.
        package var isCall = false
        /// Something somebody SAID — neither the work nor the punctuation around it.
        package var isProse = false
        /// Something the AGENT said. Narrower than `isProse`: a Turn's final message routinely
        /// contradicts its own reasoning, so counting a thought would promise two answers where
        /// the agent gave one.
        package var isMessage = false
        /// Something the USER asked for.
        package var isPrompt = false
        /// A call the record has not answered yet — the one the ion crosses. A folded run is not
        /// one even while a call inside it is pending: the row is a count rather than a line, and
        /// the working thread is what stands over it.
        var isCallInFlight = false
        /// Whether there is anything for the evidence panel to show. One rule for pointer and
        /// keyboard, so a row that draws no disclosure marker does not open on Return either.
        var opensEvidence = false
        /// Whether a Turn ends at this row — the stop reason the host reported, and the
        /// interruption that stands in for one. A fact about the READING rather than about the
        /// row: the overview lane's blocks and the feed's Copy turn are both cut by it
        /// (`TurnExtents`).
        var endsTurn = false
        /// The working thread — the one row the reading measure does not hold, so its ion sweeps
        /// the zone's full width and exits at the minimap's seam.
        var isWorkingThread = false
        /// The pictures this row holds, which is how a lit picture finds its way home. Two kinds
        /// do: a call's gallery, and the prompt somebody pasted one into (#733).
        var shots: [FeedShot] = []
        /// This row's own words, exactly as the record holds them — the markdown SOURCE and never
        /// the rendered glyphs. `nil` for every row that is not something somebody SAID: a call, a
        /// question and a mark each carry a line Argo composed rather than anything verbatim. A
        /// prompt's pasted pictures are not words, so its own words are its text alone.
        var words: String?
        /// What a menu calls copying this row. Each kind names itself rather than sharing one word:
        /// the reader right-clicked a specific thing, and `Copy` alone would leave them guessing
        /// whether they got the row or the whole Turn.
        var copyLabel: String?
        var activation = Activation.inert
    }

    /// The one exhaustive `switch` over the kinds that answers a FACT about a row. No `default`, so
    /// an eleventh kind fails this build rather than quietly inheriting answers written for the ten
    /// that exist. Three switches remain, each resolving a payload per case rather than a fact and
    /// none of them precomputable per row per reshape: `opened` below, `FeedRowView.body` and
    /// `MinimapRow.shape`.
    var kind: Kind {
        switch self {
        // A prompt that is ONLY a picture has no fold for the key to work, so it opens the picture
        // instead — the gallery's answer, on the row the picture arrived in.
        case let .prompt(text, shots):
            Kind(
                isProse: true,
                isPrompt: true,
                shots: shots,
                words: text,
                copyLabel: "Copy Prompt",
                activation: text.isEmpty ? .light(oneOf: shots) : .fold,
            )
        case let .message(text):
            Kind(
                isProse: true,
                isMessage: true,
                words: text,
                copyLabel: "Copy Message",
            )
        case let .thought(text):
            Kind(isProse: true, words: text, copyLabel: "Copy Thought")
        case let .call(call):
            Kind(
                isCall: true,
                isCallInFlight: call.ending == .pending,
                opensEvidence: call.disclosure == .available,
                activation: .openEvidence,
            )
        case let .survey(survey):
            Kind(
                isCall: true,
                opensEvidence: survey.disclosure == .available,
                activation: .openEvidence,
            )
        // A gallery opens no panel — what a shot produced IS the shot, so the click goes to the
        // picture. Said once here, for the row and the lane beside it both.
        case let .gallery(gallery):
            Kind(isCall: true, shots: gallery.shots, activation: .light(oneOf: gallery.shots))
        // A marker is punctuation too, and it opens onto whatever Argo could read behind it — the
        // SKILL.md body, or the sentence saying why there is none.
        case let .skillLoaded(skill):
            Kind(opensEvidence: skill.opened != nil, activation: .openEvidence)
        // Punctuation: a question and a mark each take the full step prose gets without being any
        // of these things, and neither opens anything.
        case .ask: Kind()
        case let .mark(mark): Kind(endsTurn: mark.endsTurn, isWorkingThread: mark == .working)
        // The raw text is behind a fold, so the key that opens it is the fold's own.
        case .unreadable: Kind(activation: .fold)
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
