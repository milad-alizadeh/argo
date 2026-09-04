import ArgoEngine
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
        let kind = row.kind
        prompt = kind.isPrompt ? kind.words : nil
        endsTurn = kind.endsTurn
    }
}

private extension FeedRow.Content {
    @MainActor func shape(isFolded: Bool) -> MinimapRowShape {
        switch self {
        // The prompt's pictures and lines, held against the trailing edge its bubble is drawn on.
        case let .prompt(text, shots): .bubble(
                text: text,
                shots: shots.map(\.drawnWidth),
                isFolded: isFolded,
            )
        case let .message(text): MinimapProseBlock.shape(of: text, ink: .message)
        case let .thought(text): MinimapProseBlock.shape(of: text, ink: .thought)
        case let .call(call): call.shape
        case let .survey(survey): .line(
                parts: [.words(survey.label, survey.ending.ink)],
                ink: survey.ending.ink,
            )
        case let .work(work): .line(
                parts: [.words(work.label, work.ending.ink)],
                ink: work.ending.ink,
            )
        case let .unreadable(unreadable): .line(
                parts: [.words(unreadable.label, .unreadable)],
                ink: .unreadable,
            )
        // A chip's own words, at the ink the marker itself takes: punctuation, unless the file
        // could not be read, which is a failure and carries a failure's colour in both places.
        case let .skillLoaded(skill): .line(
                parts: [.words(skill.spoken, skill.ink)],
                ink: skill.ink,
            )
        // Rows the lane draws as a shape rather than as words. Each asks its own type for its ink
        // rather than answering for it here: a question that has been answered goes quiet in the
        // row, and the lane has to go quiet with it.
        case let .gallery(gallery): .shots(widths: gallery.shots.map(\.drawnWidth))
        case let .ask(ask): .card(ask.card)
        case let .mark(mark): .whole(mark.ink)
        // A wait that ended, as its own words — a settled one at the boundary rung, and a
        // failed one in the failure ink the row itself takes. The lane must not show a red
        // line as quiet grey: a run of red is the one thing a reader scans an overview for.
        case let .settledWait(settled): .line(
                parts: [.words(FeedWaitWords(settled.wait).settled, settled.laneInk)],
                ink: settled.laneInk,
            )
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

extension SessionWaitSettled {
    /// What the lane draws this wait in — the row's own answer, so the two cannot disagree.
    var laneInk: FeedInk {
        failure == nil ? .boundary : .failure
    }
}
