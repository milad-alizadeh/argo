import ArgoEngine

// The one feed every specimen and `#Preview` is drawn from. Held apart from the projection
// itself because none of it ships: it is the fixture, already read, so no two surfaces can be
// looking at a different feed — and so nothing here can be mistaken for the reading.

extension FeedProjection {
    /// The preview transcript, already projected — the one place every specimen and `#Preview`
    /// takes its rows from, so none of them can be looking at a different feed.
    static let previewRows = rows(from: CockpitPresentation.Session.previewTranscript)

    /// A session at the length a real one reaches, projected. What every claim about SCALE is
    /// checked against — the specimen render, the `#Preview`, and the measurement #427 asks for.
    /// See `CockpitPresentation.Session.longTranscript`.
    static let longRows = rows(from: CockpitPresentation.Session.longTranscript)

    /// The LAST failed call in that long feed, and the last rather than the first because a panel
    /// opened fifty turns above the fold would be a screenshot of a pane beside a stretch of
    /// reading nobody can see.
    static let longFailedCallID = longRows.reversed().failedCallID

    /// The same feed with the prose taken out. A render of the call vocabulary that is four fifths
    /// paragraphs is a render of the paragraphs — this is a filter over the shipping rows, never a
    /// second set of them.
    static let previewCallRows = previewRows.filter(\.isCall)

    /// The rows the agent narrated itself, on their own — a Claude Code feed as that host actually
    /// writes one, where a command arrives with the agent's account of what it was for. A filter
    /// over the shipping rows like the rest: sentences written here would be a render of a feed
    /// nobody is shown, and the one claim worth looking at is that prose in this slot still reads
    /// as a row rather than as a paragraph.
    static let previewNarratedRows = numbered(previewCallRows.compactMap { row in
        guard case let .call(call) = row.content, case .narration = call.subject else { return nil }
        return row.content
    })

    /// The same feed with the work taken out — what the agent SAID, at the shape it said it in. A
    /// render of a transcript that is four fifths tool calls is a render of the tool calls.
    static let previewProseRows = previewRows.filter(\.isProse)

    /// The questions in that feed — the one still waiting and the one already settled. Taken off
    /// the shipping rows, so a render of the attention state cannot be a render of a question
    /// nobody is shown.
    static let previewAsks = previewRows.compactMap { row -> FeedAsk? in
        guard case let .ask(ask) = row.content else { return nil }
        return ask
    }

    /// Every mark that feed is punctuated with, in the order the reading meets them.
    static let previewMarks = previewRows.compactMap { row -> FeedMark? in
        guard case let .mark(mark) = row.content else { return nil }
        return mark
    }

    /// The attention state on its own: both questions, with everything they were asked between
    /// taken away. In the full feed they are two rows in a screenful, and a render where the one
    /// waiting is below the fold settles nothing about the ink it takes.
    static let previewAskRows = numbered(previewAsks.map(FeedRow.Content.ask))

    /// The punctuation on its own, for the same reason — and it is the render that answers whether
    /// the hairlines read as the shape of the reading rather than as rules drawn under rows.
    static let previewMarkRows = numbered(previewMarks.map(FeedRow.Content.mark))

    /// Contents taken off the shipping feed, given their places back. Not a second way to build a
    /// row: every one of these came out of `previewRows`, and only the gaps between them are new.
    private static func numbered(_ contents: [FeedRow.Content]) -> [FeedRow] {
        contents.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }

    /// The collapsed run in that feed — the row standing for three edits of one file, which is the
    /// only row whose panel holds more than one thing.
    static let previewRunCallID = previewRows.first { row in
        guard case let .call(call) = row.content else { return false }
        return call.repeats > 1
    }?.id

    /// The folded run of looking in that feed — the row standing for the reconnaissance a turn
    /// opens with, and the only row whose panel captions each of its steps.
    static let previewSurveyRowID = previewRows.first { row in
        if case .survey = row.content {
            return true
        }
        return false
    }?.id

    /// The markdown document in that feed — the one row whose panel opens as prose rather than as
    /// a patch, because the agent wrote the whole file and there is no change in it to read.
    static let previewDocumentCallID = previewRows.first { row in
        guard case let .call(call) = row.content, case let .file(file) = call.subject else {
            return false
        }
        return EvidenceLanguage(path: file.path) == .markdown && call.kind == .create
    }?.id

    /// The pictures in that feed, in the order the turn produced them — every provenance the
    /// cockpit tells apart, taken off the shipping rows rather than written out beside them.
    static let previewShots: [FeedShot] = previewRows.flatMap { row -> [FeedShot] in
        guard case let .gallery(gallery) = row.content else { return [] }
        return gallery.shots
    }

    /// One shot on its own. A filter over those same shots and not a second set of them: whether a
    /// gallery of one gets the same treatment as a gallery of six is only answerable if both are
    /// made of the same pictures.
    static let previewSingleShotRows = gallery(of: Array(previewShots.prefix(1)))

    /// The shot the record kept no bytes for, alone — the one state a reader has to be able to tell
    /// from a picture that failed to load, with nothing beside it to borrow an explanation from.
    static let previewAbsentShotRows = gallery(of: previewShots.filter { !$0.isOpenable })

    private static func gallery(of shots: [FeedShot]) -> [FeedRow] {
        shots.isEmpty ? [] : [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
    }

    /// The failed call in that feed — the row every surface showing an OPEN panel opens on, so a
    /// specimen and a `#Preview` cannot be looking at two different failures.
    static let previewFailedCallID = previewRows.failedCallID
}

private extension Sequence<FeedRow> {
    /// The first row in this order that stands for a call the record answered with a failure.
    /// Both feeds want it and neither wants the same end of the feed, so the direction is the
    /// caller's and the rule is written once.
    var failedCallID: FeedRow.ID? {
        first { row in
            guard case let .call(call) = row.content else { return false }
            return call.ending.hasFailed
        }?.id
    }
}
