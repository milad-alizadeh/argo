import ArgoEngine

// The one feed every specimen and `#Preview` is drawn from — the fixture, already read.

extension FeedProjection {
    /// The preview transcript, already projected — with its unanswered question handed in as the
    /// live one, because a waiting ask nobody can answer draws quiet now (#712) and this fixture is
    /// what the attention state is rendered from.
    static let previewRows = rows(
        from: TranscriptFixtures.previewTranscript,
        asking: previewTranscriptAsking,
    )

    /// The question left waiting in that transcript, as the gate would hold it.
    private static let previewTranscriptAsking = FeedAskProjection.Asking(
        live: TranscriptFixtures.previewTranscript
            .compactMap { event -> FeedAskProjection.Live? in
                guard case let .toolCall(call) = event, let ask = call.ask,
                      call.id == "ask-waiting" else { return nil }
                return FeedAskProjection.Live(sessionID: "session", askID: call.id, ask: ask)
            }.first,
        isDriveable: true,
    )

    /// A session at the length a real one reaches, projected — what every claim about SCALE is
    /// checked against, including the measurement #427 asks for.
    static let longRows = rows(from: TranscriptFixtures.longTranscript)

    /// The LAST failed call in that long feed: one opened above the fold renders a pane beside
    /// reading nobody can see.
    static let longFailedCallID = longRows.reversed().failedCallID

    /// Prompts somebody pasted a picture into, projected — the thumbnail row inside a bubble, and
    /// the wordless prompt that is nothing but one (#733).
    static let previewPastedRows = rows(from: TranscriptFixtures.pasted)

    /// The same feed with the prose taken out. A filter over the shipping rows, never a second set.
    static let previewCallRows = previewRows.filter(\.kind.isCall)

    /// The rows the agent narrated itself — a Claude Code feed, where a command arrives with the
    /// agent's account of what it was for.
    static let previewNarratedRows = numbered(previewCallRows.compactMap { row in
        guard case let .call(call) = row.content, case .narration = call.subject else { return nil }
        return row.content
    })

    /// A Codex Session's commands, projected — the feed a CLI that narrates nothing produces. Not
    /// a filter over the preview rows: those are a Claude Code record, whose commands arrive
    /// narrated.
    static let previewCommandRows = rows(from: TranscriptFixtures.ranCommands)

    /// A turn that looked around through a shell and then changed something, projected. Its own
    /// fixture: it is a render of the boundary between a folded stretch and the loud rows either
    /// side of it, which no filter over another feed has.
    static let previewFoldRows = rows(from: TranscriptFixtures.foldedLooking)

    /// The same feed with the work taken out — what the agent SAID, at the shape it said it in.
    static let previewProseRows = previewRows.filter(\.kind.isProse)

    /// The questions in that feed — the one still waiting and the one already settled.
    static let previewAsks = previewRows.compactMap { row -> FeedAsk? in
        guard case let .ask(ask) = row.content else { return nil }
        return ask
    }

    /// Every mark that feed is punctuated with, in the order the reading meets them.
    static let previewMarks = previewRows.compactMap { row -> FeedMark? in
        guard case let .mark(mark) = row.content else { return nil }
        return mark
    }

    /// The same reading, handed over. The whole feed and not a filter: the render has to settle
    /// the row's place, last under the Session's whole transcript and its spend.
    static let previewHandedOffRows = rows(
        from: TranscriptFixtures.previewTranscript,
        handedOff: previewHandoff,
    )

    /// A reading with the Session still working under it — the whole feed, so the render settles
    /// the row's place. The commands rather than the shipping transcript: the full reading renders
    /// as an empty column today (the lazy-height estimates of #473 and #476).
    static let previewWorkingRows = rows(
        from: TranscriptFixtures.ranCommands,
        working: true,
    )

    /// The same reading with its last command still in flight. `working: true` because the two are
    /// one fact: a call is pending only while the Turn that made it is running. The failed row sits
    /// four above it on purpose — the ion and the one outcome with a colour are judged together.
    static let previewPendingCallRows = rows(
        from: TranscriptFixtures.runningCommand,
        working: true,
    )

    /// The punctuation with a Permission that ran out among it (#573) — the marks-only set, so a
    /// refusal nobody made can be compared against the marks around it on one screen.
    static let previewExpiredMarkRows = numbered(
        (previewMarks + [.permissionExpired(previewExpiry)]).map(FeedRow.Content.mark),
    )

    /// `Bash` deliberately — the tool whose prompt the study's render is drawn over, so the row and
    /// the prompt it is the end of name the same call.
    static let previewExpiry = PermissionExpiry(id: "permission-1", toolName: "Bash")

    /// The Session the preview reading was handed to. Titled at the length a real title reaches,
    /// because the link is only judgeable there.
    static let previewHandoff = FeedHandoff(
        sessionID: "session-handed-to",
        title: "Ship the native Liquid Glass application shell",
    )

    /// The attention state on its own: both questions, with everything asked between taken away.
    /// In the full feed the waiting one falls below the fold.
    static let previewAskRows = numbered(previewAsks.map(FeedRow.Content.ask))

    /// The three states a skill marker has (#688): the body Argo read, the file it could not, and
    /// the one with nothing behind it at all. Only the first is in the shipping transcript — the
    /// other two need a `SKILL.md` that is missing or empty, which no fixture stream can carry.
    static let previewSkillLoads: [FeedSkillLoad] = [
        FeedSkillLoad(TranscriptFixtures.previewSkillLoad),
        FeedSkillLoad(SkillLoad(
            name: "pixel-review",
            directory: "~/.claude/skills/pixel-review",
            body: .unreadable("Argo could not read ~/.claude/skills/pixel-review/SKILL.md."),
        )),
        FeedSkillLoad(SkillLoad(
            name: "grill-me",
            directory: "~/.claude/skills/grill-me",
            body: nil,
        )),
    ]

    /// Those three as rows, so the states can be judged against each other on one screen.
    static let previewSkillLoadRows = numbered(previewSkillLoads.map(FeedRow.Content.skillLoaded))

    /// The state the design's own render draws: the command the user typed, their line verbatim,
    /// and the marker under it. Projected from events rather than assembled from rows, so what the
    /// still shows is what the shipping projection produces.
    static let previewSkillLoadedTurn = rows(from: [
        .prompt(
            text: "/implement 688 — the feed says a Session loaded a skill",
            images: [],
            atMs: 1000,
        ),
        .skillLoaded(TranscriptFixtures.previewSkillLoad),
        .message(markdown: "Reading the ticket and the design it points at."),
    ])

    /// The one whose panel holds the body Argo read, and the one whose panel states a read failure.
    /// Both found by the state itself rather than by position, so a fourth marker added above them
    /// cannot silently re-point either still.
    static let previewSkillLoadRowID = previewSkillLoadRow { $0.body?.hasFailed == false }

    static let previewSkillUnreadableRowID = previewSkillLoadRow { $0.body?.hasFailed == true }

    private static func previewSkillLoadRow(where match: (SkillLoad) -> Bool) -> FeedRow.ID? {
        previewSkillLoadRows.first { row in
            guard case let .skillLoaded(skill) = row.content else { return false }
            return match(skill.load)
        }?.id
    }

    /// The punctuation on its own, for the same reason. The interrupt is added rather than found:
    /// the shipping preview transcript carries no stopped Turn (#541).
    static let previewMarkRows = numbered(
        (previewMarks + [.interrupted]).map(FeedRow.Content.mark),
    )

    /// A reading whose one message carries every markdown block Argo draws — the table above all —
    /// between two prompts. What the overview lane is judged on: a table has to read as its cells,
    /// a paragraph's bars as the widths its lines wrapped to, and a one-line prompt as one line.
    static let previewMarkdownRows = numbered([
        .prompt(text: "Take the design PR state and turn it into tickets", shots: []),
        .message(MarkdownSpecimen.message),
        .prompt(text: "/clear", shots: []),
    ])

    /// Contents taken off the shipping feed, given their places back — only the gaps are new.
    private static func numbered(_ contents: [FeedRow.Content]) -> [FeedRow] {
        contents.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }

    /// The two rows the keyboard cursor is rendered on (#533): the one drawn narrower than the
    /// measure, and one drawn at it.
    ///
    /// Both taken from the END of their reading, which is where a reading opens. A cursor further
    /// up needs a scroll to be seen, and a scroll over rows whose heights are still estimates
    /// lands somewhere else once they are measured — a still nobody can repeat.
    static let previewPromptID = previewProseRows.last(where: \.kind.isPrompt)?.id

    /// The message the copy chip is drawn on (#767). From the same end, for the same reason.
    static let previewMessageID = previewProseRows.last(where: \.kind.isMessage)?.id

    static let previewLastFailedCallID = previewRows.reversed().failedCallID

    /// The collapsed run in that feed — three edits of one file, the only row whose panel holds
    /// more than one thing.
    static let previewRunCallID = previewRows.first { row in
        guard case let .call(call) = row.content else { return false }
        return call.repeats > 1
    }?.id

    /// The folded run of looking in that feed — the only row whose panel captions each of its
    /// steps.
    static let previewSurveyRowID = previewRows.first { row in
        if case .survey = row.content {
            return true
        }
        return false
    }?.id

    /// The markdown document in that feed — the one row whose panel opens as prose rather than as
    /// a patch: the agent wrote the whole file, so there is no change in it to read.
    static let previewDocumentCallID = previewRows.first { row in
        guard case let .call(call) = row.content, case let .file(file) = call.subject else {
            return false
        }
        return EvidenceLanguage(path: file.path) == .markdown && call.kind == .create
    }?.id

    /// The pictures in that feed, in the order the turn produced them — every provenance the
    /// cockpit tells apart.
    static let previewShots: [FeedShot] = previewRows.flatMap { row -> [FeedShot] in
        guard case let .gallery(gallery) = row.content else { return [] }
        return gallery.shots
    }

    /// One shot on its own. A filter over those same shots, so a gallery of one and a gallery of
    /// six are made of the same pictures.
    static let previewSingleShotRows = gallery(of: Array(previewShots.prefix(1)))

    /// The shot the record kept no bytes for, alone — the state a reader has to tell from a
    /// picture that failed to load, with nothing beside it to borrow an explanation from.
    static let previewAbsentShotRows = gallery(of: previewShots.filter { !$0.isOpenable })

    private static func gallery(of shots: [FeedShot]) -> [FeedRow] {
        shots.isEmpty ? [] : [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
    }

    /// The failed call in that feed — the row every surface showing an OPEN panel opens on.
    static let previewFailedCallID = previewRows.failedCallID

    /// The row a reader left the end at with six of the Session's messages still below them.
    ///
    /// Several and not one: the badge counts what was SAID, and the long feed puts dozens of calls
    /// under this row per message. Six and not three: under three messages there is less than a
    /// pane below, so the scroll clamps to the bottom and the case renders as a reading that
    /// never left the end.
    ///
    /// Derived from the rows rather than hard-coded — an index goes on rendering SOME row the day
    /// the fixture transcript grows a turn, while ceasing to be the one the count was chosen for.
    static let longHeldRowID = longRows.leaving(6)

    /// That same reading with everything SAID below the reader's place taken out — held at the
    /// same place, so the two renders differ by the badge and by nothing else.
    ///
    /// Cut by POSITION rather than by comparing `FeedRow.ID`s: the ids are dense today, so `<=`
    /// would work and would be a fixture quietly depending on that.
    static let longSilentRows: [FeedRow] = {
        guard let at = longRows.firstIndex(where: { $0.id == longHeldRowID }) else { return [] }
        return longRows.prefix(through: at) + longRows[longRows.index(after: at)...]
            .filter { !$0.kind.isMessage }
    }()
}

private extension Sequence<FeedRow> {
    /// The first row in this order that stands for a call the record answered with a failure.
    /// The direction is the caller's: the two feeds want opposite ends.
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
        let messages = filter(\.kind.isMessage)
        guard messages.count >= count else { return nil }
        let opening = messages[messages.count - count].id
        guard let at = firstIndex(where: { $0.id == opening }), at > 0 else { return nil }
        return self[at - 1].id
    }
}
