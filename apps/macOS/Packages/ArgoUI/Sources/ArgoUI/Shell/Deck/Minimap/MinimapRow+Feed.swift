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
    /// `read` is the state the READING is in rather than the row: the reader's own fold, which only
    /// the feed holds and which a prompt is the one row to change shape under, and the Ticket links
    /// the words are drawn through.
    @MainActor init(
        _ row: FeedRow,
        height: CGFloat,
        under previous: FeedRow? = nil,
        read: MinimapReadingState = MinimapReadingState(),
    ) {
        self.init(
            height: height,
            shape: row.content.shape(read: read),
            topStep: FeedRow.step(to: row, from: previous),
        )
        let kind = row.kind
        // A prompt of no words names its Turn with nothing. Reported as words all the same, the
        // empty label still takes a slot from `MinimapAnnotation.legible`, which drops the words
        // of any label landing on the one above it — so an unnamed Turn silenced a named one. It
        // matters now that a whole run of pasted pictures folds into ONE such row (#1252).
        prompt = kind.isPrompt ? kind.words.flatMap { $0.isEmpty ? nil : $0 } : nil
        endsTurn = kind.endsTurn
    }
}

private extension FeedRow.Content {
    /// A block of the agent's own words at the lane's scale. One path for both voices, because
    /// the ink is the only thing that differs between them.
    @MainActor func prose(
        _ text: String,
        ink: FeedInk,
        read: MinimapReadingState,
    )
        -> MinimapRowShape {
        MinimapProseBlock.shape(of: FeedTicketProse.worded(text, as: read.tickets), ink: ink)
    }

    @MainActor func shape(read: MinimapReadingState) -> MinimapRowShape {
        switch self {
        // The prompt's pictures and lines, held against the trailing edge its bubble is drawn on.
        case let .prompt(text, shots): .bubble(
                text: text,
                shots: shots.map(\.drawnWidth),
                isFolded: read.isFolded,
            )
        case let .submitted(text): .bubble(text: text, shots: [], isFolded: read.isFolded)
        // Worded as the feed words them, so the lane is a miniature of the reading and not of the
        // record behind it (#1178) — the same string `FeedShapeHeight` took the height from.
        case let .message(text): prose(text, ink: .message, read: read)
        case let .thought(text): prose(text, ink: .thought, read: read)
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
        // A delegation that ended, in the ink its row takes — so a failed one shows red in the
        // lane too, for the reason the settled wait above it does.
        case let .delegationEnded(end): .line(
                parts: [.words(end.label, end.ink)],
                ink: end.ink,
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

/// How the READING a row belongs to is being read, as one value: the reader's own fold, and which
/// of its links Argo can say as a Ticket.
///
/// One value rather than two arguments because neither is a fact about the row — both are the
/// lane's whole walk, handed down — and because an initializer here is at the four-parameter cap
/// the boundaries gate holds it to (#755).
struct MinimapReadingState {
    /// Whether the reader has this row's prompt folded. Every row but a prompt ignores it.
    var isFolded = true
    /// What the feed words as a Ticket, so the lane's silhouette is of the words the feed drew
    /// rather than of the URLs the record carried (#1178).
    var tickets: FeedTicketLinks = .none
}
