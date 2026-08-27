/// What the reader takes away from the feed, as text (#734).
///
/// The markdown SOURCE and never the rendered glyphs, so a paste carries the fences, the emphasis
/// and the link addresses the screen resolved away.
enum FeedCopy {
    /// Separates two rows of one Turn. A blank line, because each row is a markdown document of its
    /// own and two of them run together would fuse a paragraph onto the one above it.
    private static let between = "\n\n"

    /// What the chip calls taking a Turn's messages. Plural, and not `Copy Turn`: the menu's Turn
    /// is every word of it, and two controls named alike must not hand over different text.
    private static let chipLabel = "Copy Messages"

    /// Every word of the Turn a row falls in, in reading order. `nil` where the row is outside the
    /// reading, or where nobody said anything in that Turn — a paste of the empty string reads as
    /// the copy having silently failed.
    ///
    /// The work is left out. `Read 3 files` is a line Argo composed from the record rather than
    /// something the agent wrote, and mixed in with the words it would not be marked as such.
    static func turn(of rows: [FeedRow], holding index: Int) -> String? {
        guard let span = TurnExtents.span(holding: index, of: reading(rows)) else { return nil }
        return joined(rows[span].compactMap(\.kind.words))
    }

    /// The ONE chip a Turn draws, and what it hands over: every message of that Turn, on the last
    /// of them (#767). The prompt is the reader's own words and a Turn routinely contradicts its
    /// own reasoning, so neither belongs in what the chip takes.
    static func chipOffer(of rows: [FeedRow], at index: Int) -> FeedRow.CopyOffer? {
        guard rows.indices.contains(index), rows[index].kind.isMessage,
              let span = TurnExtents.span(holding: index, of: reading(rows)),
              span.last(where: { rows[$0].kind.isMessage }) == index,
              let words = joined(span.compactMap(messageWords(of: rows)))
        else { return nil }
        return FeedRow.CopyOffer(words: words, label: chipLabel)
    }

    /// The feed's rows as the Turn rule reads them: a prompt opens, the feed's own punctuation
    /// ends.
    private static func reading(_ rows: [FeedRow]) -> TurnExtents.Reading {
        TurnExtents.Reading(
            count: rows.count,
            opensTurn: { rows[$0].kind.isPrompt },
            endsTurn: { rows[$0].kind.endsTurn },
        )
    }

    /// One Turn row's words, where the row is a message and nothing else.
    private static func messageWords(of rows: [FeedRow]) -> (Int) -> String? {
        { rows[$0].kind.isMessage ? rows[$0].kind.words : nil }
    }

    private static func joined(_ words: [String]) -> String? {
        words.isEmpty ? nil : words.joined(separator: between)
    }
}

extension FeedRow {
    /// What a control hands over and what it calls doing it, together — the two travel as one so a
    /// chip cannot draw one thing and name another.
    struct CopyOffer: Equatable {
        let words: String
        let label: String
    }
}
