import Foundation

// A feed row read as the shape the lane draws it with (#382). The one place the miniature's
// vocabulary meets the feed's, and the reason the lane reads as the reading shrunk rather than as a
// legend beside it: every alignment here is the row's own, and every ink is the row's own.
//
// Nothing here measures a string. It runs over every row of the reading each time the feed
// reshapes, so a prose row's markdown structure comes off `ProseReading`'s cache — one parse per
// distinct text, a lookup after — and the glyphs are measured later, for the lane's band alone.

extension MinimapRow {
    /// One feed row as the lane draws it, at the height the table measured for it and after the
    /// step its cell carries above it.
    ///
    /// `isFolded` is the reader's own state, which only the feed holds — a prompt is the one row it
    /// changes the shape of.
    @MainActor init(
        _ row: FeedRow,
        height: CGFloat,
        under previous: FeedRow? = nil,
        isFolded: Bool = true,
    ) {
        self.init(
            height: height,
            shape: row.content.shape(isFolded: isFolded),
            topStep: FeedRow.step(to: row, from: previous),
        )
        if case let .prompt(text) = row.content {
            prompt = text
        }
        endsTurn = row.content.endsTurn
    }
}

private extension FeedRow.Content {
    @MainActor func shape(isFolded: Bool) -> MinimapRowShape {
        switch self {
        // The prompt's lines, held against the trailing edge its bubble is drawn on.
        case let .prompt(text): .bubble(text: text, isFolded: isFolded)
        case let .message(text): MinimapProseBlock.shape(of: text, ink: .message)
        case let .thought(text): MinimapProseBlock.shape(of: text, ink: .thought)
        case let .call(call): call.shape
        case let .survey(survey): .line(
                parts: [.words(survey.label, survey.ending.ink)],
                ink: survey.ending.ink,
            )
        case let .unreadable(unreadable): .line(
                parts: [.words(unreadable.label, .unreadable)],
                ink: .unreadable,
            )
        // Rows the lane draws as a shape rather than as words. Each asks its own type for its ink
        // rather than answering for it here: a question that has been answered goes quiet in the
        // row, and the lane has to go quiet with it.
        case let .gallery(gallery): .shots(count: gallery.shots.count)
        case let .ask(ask): .card(ask.card)
        case let .mark(mark): .whole(mark.ink)
        }
    }

    /// Whether a Turn ends at this row. The feed's own punctuation and nothing else: the stop
    /// reason the host reported, and the interruption that stands in for one.
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
}

private extension FeedCall {
    /// A call as the lane draws it: the pieces of its sentence, in the order `FeedCallLine` sets
    /// them and each in its own ink.
    ///
    /// A failure keeps its counts but not their inks — the feed puts the whole line in the failure
    /// ink, and diff colours beside a red line would read as a change that landed.
    var shape: MinimapRowShape {
        .line(parts: parts, ink: ending.ink)
    }

    private var parts: [MinimapLinePart] {
        var parts: [MinimapLinePart] = [
            .column(ArgoFeedRow.callSymbolWidth, ending.ink),
            .words(kind.verb, ending.ink),
            .words(subject.captioned, ending.ink),
        ]
        if repeats > 1 {
            parts.append(.words("×\(repeats)", ending.ink, in: .machine))
        }
        parts += churnParts
        if let printed = printed?.drawn {
            parts.append(.words(printed, ending.ink, in: .machine))
        }
        return parts
    }

    /// What the mutation did, exactly as the row draws it: each half only where it did something,
    /// so a pure addition shows one count rather than a `−0` nobody wrote.
    private var churnParts: [MinimapLinePart] {
        guard let churn, !churn.isSilent else { return [] }
        let ink = ending.hasFailed ? ending.ink : nil
        return [
            churn.added > 0 ? MinimapLinePart.words("+\(churn.added)", ink ?? .added, in: .machine)
                : nil,
            churn.removed > 0
                ? MinimapLinePart.words("−\(churn.removed)", ink ?? .removed, in: .machine) : nil,
        ]
        .compactMap(\.self)
    }
}
