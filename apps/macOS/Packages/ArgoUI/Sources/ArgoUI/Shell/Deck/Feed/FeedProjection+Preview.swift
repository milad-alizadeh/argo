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

    /// A Codex Session's commands, projected — the feed a CLI that narrates nothing produces, and
    /// the one place the shortening rule is looked at rather than asserted. Not a filter over the
    /// preview rows: those are a Claude Code record, and its commands arrive narrated.
    static let previewCommandRows = rows(from: CockpitPresentation.Session.ranCommands)

    /// A turn that looked around through a shell and then changed something, projected. Its own
    /// fixture rather than a filter: what it is a render OF is the boundary between a folded
    /// stretch and the loud rows either side of it, and no filter over another feed has one.
    static let previewFoldRows = rows(from: CockpitPresentation.Session.foldedLooking)

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

    /// The same reading, handed over. The whole feed and not a filter, because what the render has
    /// to settle is the row's place: the last thing under a Session's whole transcript and its
    /// spend, reading as a way OUT of it rather than as one more thing the agent said.
    static let previewHandedOffRows = rows(
        from: CockpitPresentation.Session.previewTranscript,
        handedOff: previewHandoff,
    )

    /// A reading with the Session still working under it. A whole feed and not the mark alone, for
    /// `previewHandedOffRows`'s reason: what the render settles is the row's PLACE — the work above
    /// it, the spend below it, and whether a live state reads as the reading continuing rather than
    /// as a footnote about it.
    ///
    /// The commands rather than the shipping transcript, and that is a limit rather than a choice:
    /// the full reading renders as an empty column today (the same lazy-height estimates #473 and
    /// #476 are about), so a render drawn from it would settle nothing about a row at its foot.
    static let previewWorkingRows = rows(
        from: CockpitPresentation.Session.ranCommands,
        working: true,
    )

    /// The punctuation with a Permission that ran out among it (#573) — the marks-only set, for
    /// `previewMarkRows`'s reason and one more: what the render settles is that a refusal nobody
    /// made reads as a departure from the marks around it, which needs those marks on one screen.
    static let previewExpiredMarkRows = numbered(
        (previewMarks + [.permissionExpired(previewExpiry)]).map(FeedRow.Content.mark),
    )

    /// `Bash` deliberately — the tool whose prompt the study's render is drawn over, so the row and
    /// the prompt it is the end of name the same call.
    static let previewExpiry = PermissionExpiry(id: "permission-1", toolName: "Bash")

    /// The Session the preview reading was handed to. Titled like a real one, because the link is
    /// only judgeable at the length a title actually reaches.
    static let previewHandoff = FeedHandoff(
        sessionID: "session-handed-to",
        title: "Ship the native Liquid Glass application shell",
    )

    /// The attention state on its own: both questions, with everything they were asked between
    /// taken away. In the full feed they are two rows in a screenful, and a render where the one
    /// waiting is below the fold settles nothing about the ink it takes.
    static let previewAskRows = numbered(previewAsks.map(FeedRow.Content.ask))

    /// The punctuation on its own, for the same reason — and it is the render that answers whether
    /// the hairlines read as the shape of the reading rather than as rules drawn under rows.
    ///
    /// The interrupt is added rather than found: the shipping preview transcript carries no stopped
    /// Turn, and this set is the one place the mark is ever looked at (#541).
    static let previewMarkRows = numbered(
        (previewMarks + [.interrupted]).map(FeedRow.Content.mark),
    )

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

    /// The row a reader left the end at with six of the Session's messages still below them.
    ///
    /// Several rather than one, because what the badge has to prove is that it counts what was SAID
    /// and not what arrived: the long feed puts dozens of calls under this row for every message,
    /// and a single-digit number on a control with that much work beneath it is the whole claim.
    /// Six and not three because the render has to be a reading that visibly LEFT the end — under
    /// three messages there is less than a pane below, so the scroll clamps to the bottom and the
    /// case comes out as a control standing over a reading that never went anywhere.
    ///
    /// Derived from the rows rather than written down. A hard-coded index is a number that means
    /// nothing the day the fixture transcript grows a turn, and it would go on rendering SOME row
    /// while quietly ceasing to be the one the count was chosen for.
    static let longHeldRowID = longRows.leaving(6)

    /// That same reading with everything SAID below the reader's place taken out.
    ///
    /// A long stretch of work and no prose, and a filter over the same rows held at the same place,
    /// so the two renders differ by the badge and by nothing else.
    ///
    /// Cut by POSITION in the list rather than by comparing `FeedRow.ID`s. The ids are dense today,
    /// so `<=` would work and would be a fixture quietly depending on that — the same assumption
    /// that put a Session's reading at another Session's offset.
    static let longSilentRows: [FeedRow] = {
        guard let at = longRows.firstIndex(where: { $0.id == longHeldRowID }) else { return [] }
        return longRows.prefix(through: at) + longRows[longRows.index(after: at)...]
            .filter { !$0.isMessage }
    }()
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

private extension [FeedRow] {
    /// The row a reader would have to have left the end at for `count` messages to be below them.
    ///
    /// The row BEFORE the message that opens the run, so the count is what follows the anchor
    /// rather than what includes it — which is the rule `FeedTail.newMessages` reads. `0` asks for
    /// the last row of all, where nothing at all has been said since.
    func leaving(_ count: Int) -> FeedRow.ID? {
        let messages = filter(\.isMessage)
        guard messages.count >= count else { return nil }
        let opening = messages[messages.count - count].id
        guard let at = firstIndex(where: { $0.id == opening }), at > 0 else { return nil }
        return self[at - 1].id
    }
}
