/// Where a Turn's work folds into one card per stretch, and where it does not.
///
/// Per TURN and not per run of adjacent calls, which is the whole point (#1172): an agent narrates
/// what it is doing, so the calls of one Turn are separated by the agent's own sentences and an
/// adjacency rule finds almost no run among them. Folding across that narration cut a median 46%
/// of the rows of nine real transcripts, against 28% for the adjacency rule.
///
/// The narration stays exactly where it is. The card takes the place of the FIRST call it folds,
/// so the work still reads in the order it happened and every sentence keeps the position the Turn
/// wrote it at.
enum FeedWorkFold {
    static func folded(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        var cards: [Int: FeedWork] = [:]
        var swallowed: Set<Int> = []
        for turn in TurnExtents.spans(of: reading(contents)) {
            // A stretch of ONE is not a card: `Ran 1` loses the command the row named and saves no
            // row, which is the Roster's rule for a fold of one said over the feed's rows.
            for stretch in stretches(in: turn, of: contents) where stretch.count > 1 {
                cards[stretch[0].at] = FeedWork(calls: stretch.map(\.call))
                swallowed.formUnion(stretch.dropFirst().map(\.at))
            }
        }
        guard !cards.isEmpty else { return contents }
        return contents.enumerated().compactMap { position, content in
            if let card = cards[position] {
                return .work(card)
            }
            return swallowed.contains(position) ? nil : content
        }
    }

    /// One call the fold can take: where it sits in the reading, and the call itself.
    private typealias Folding = (at: Int, call: FeedCall)

    /// One Turn's stretches, in the order they first appear, each holding its calls in the order
    /// the Turn made them.
    private static func stretches(
        in turn: ClosedRange<Int>,
        of contents: [FeedRow.Content],
    )
        -> [[Folding]] {
        var found: [(stretch: FeedWork.Stretch, folding: [Folding])] = []
        for position in turn {
            guard let call = foldable(contents[position]), let stretch = call.stretch else {
                continue
            }
            if let at = found.firstIndex(where: { $0.stretch == stretch }) {
                found[at].folding.append((position, call))
            } else {
                found.append((stretch, [(position, call)]))
            }
        }
        return found.map(\.folding)
    }

    /// Where the Turns break, read by the one rule the overview lane and the feed's Copy turn read.
    private static func reading(_ contents: [FeedRow.Content]) -> TurnExtents.Reading {
        TurnExtents.Reading(
            count: contents.count,
            opensTurn: { contents[$0].kind.isPrompt },
            endsTurn: { contents[$0].kind.endsTurn },
        )
    }

    /// The call a row is, where the fold may take it.
    ///
    /// A call that came back holding a picture is left out, exactly as the survey leaves it out:
    /// the gallery's fold has already gathered the ones it gathers, and a count is no place for
    /// the ones it did not.
    ///
    /// A call the record has not answered is left out too, and that one is not the survey's rule:
    /// a card is a count of what HAPPENED, and the call the agent is running right now is the
    /// newest moment of the reading — the ion crosses its own line (`FeedCallLineIon`), which a
    /// count has nowhere to put. It joins the card as soon as the record answers it.
    private static func foldable(_ content: FeedRow.Content) -> FeedCall? {
        guard case let .call(call) = content, !call.carriesMedia, call.ending != .pending
        else { return nil }
        return call
    }
}
