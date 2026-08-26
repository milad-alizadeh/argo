/// What the reader takes away from the feed, as text (#734).
///
/// The markdown SOURCE and never the rendered glyphs, so a paste carries the fences, the emphasis
/// and the link addresses the screen resolved away.
enum FeedCopy {
    /// Separates two rows of one Turn. A blank line, because each row is a markdown document of its
    /// own and two of them run together would fuse a paragraph onto the one above it.
    private static let between = "\n\n"

    /// Every word of the Turn a row falls in, in reading order. `nil` where the row is outside the
    /// reading, or where nobody said anything in that Turn — a paste of the empty string reads as
    /// the copy having silently failed.
    ///
    /// The work is left out. `Read 3 files` is a line Argo composed from the record rather than
    /// something the agent wrote, and mixed in with the words it would not be marked as such.
    static func turn(of rows: [FeedRow], holding index: Int) -> String? {
        guard let span = TurnExtents.span(holding: index, of: reading(rows)) else { return nil }
        return said(in: rows[span])
    }

    /// The feed's rows as the Turn rule reads them: a prompt opens, the feed's own punctuation
    /// ends.
    private static func reading(_ rows: [FeedRow]) -> TurnExtents.Reading {
        TurnExtents.Reading(
            count: rows.count,
            opensTurn: { rows[$0].isPrompt },
            endsTurn: { rows[$0].content.kind.endsTurn },
        )
    }

    private static func said(in rows: ArraySlice<FeedRow>) -> String? {
        let words = rows.compactMap(\.copyable)
        return words.isEmpty ? nil : words.joined(separator: between)
    }
}

extension FeedRow {
    /// What a row hands over and what a control calls doing it, together — the two travel as one so
    /// a chip cannot draw a thought and name it a message.
    struct CopyOffer: Equatable {
        let words: String
        let label: String
    }

    /// This row's own words, as the record holds them. `nil` for every row that is not something
    /// somebody SAID: a call, a question and a mark each carry a line Argo composed, so there is
    /// nothing verbatim to hand over.
    var copyable: String? {
        content.kind.words
    }

    /// The offer the ROW ITSELF draws — the words, and what to call taking them. Which kinds draw
    /// one is `FeedRow.Content.Kind.copiesInPlace`, which is also where the reason is.
    var inPlaceOffer: CopyOffer? {
        let kind = content.kind
        guard kind.copiesInPlace, let words = kind.words, let label = kind.copyLabel else {
            return nil
        }
        return CopyOffer(words: words, label: label)
    }

    /// What the menu calls copying it.
    var copyLabel: String? {
        content.kind.copyLabel
    }
}
