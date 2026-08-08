import ArgoEngine

/// The transcript stream, as rows to draw.
///
/// Still deliberately thin: it selects the kinds this feed draws, pairs each call with the outcome
/// that answered it, and hands every character on untouched. Everything a richer feed will want —
/// folding a turn, grouping a run of edits — is a later ticket's, and each of them is a way this
/// could stop being a reading of the record.
enum FeedProjection {
    /// Rows in the stream's own order. Nothing is sorted, nothing is promoted, and an event kind
    /// with no row yet contributes none rather than a placeholder — a surface that drew "tool call"
    /// in a box would be claiming a shape the ticket that owns it has not decided.
    static func rows(from events: [TranscriptEvent]) -> [FeedRow] {
        let answered = outcomes(in: events)
        let within = workingDirectory(in: events)
        let read = events.compactMap { content(of: $0, answeredBy: answered, within: within) }
        // In this order, and the order is load-bearing. Collapse a run of one call first, so the
        // survey counts the work rather than the lines left over from it; tell same-named files
        // apart BEFORE the fold, so a read that ends up inside a survey still carries the parent
        // its captions need — after the fold its filename is no longer in the feed to compare.
        // The gallery comes last, over a stream the survey has already left every picture out of:
        // both folds read `FeedCall.showsMedia`, so a call cannot be counted here and drawn there.
        let work = FeedGalleryFold.galleried(
            FeedSurveyFold.folded(toldApart(FeedCallRun.collapsed(read))),
        )
        return work.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }

    /// How many subagents are running right now, as far as the record can say.
    ///
    /// A delegation the transcript has not answered IS a subagent still working: the parent writes
    /// the call when it hands the work over and the result when it comes back, so the gap between
    /// them is the child's whole life. DERIVED, and it degrades the honest way — a transcript that
    /// stopped mid-turn leaves a delegation open forever, which reads as one running rather than as
    /// none, and a rail that says nothing is running while one is would be the worse of the two.
    static func runningDelegations(in rows: [FeedRow]) -> Int {
        rows.reduce(0) { running, row in
            guard case let .call(call) = row.content, call.kind == .delegate,
                  call.ending == .pending
            else { return running }
            return running + call.repeats
        }
    }

    /// Where the Session is working, which is what every address in the feed is said relative to.
    /// The LAST one the record carries: a resume chain can move, and the newest is where it is now.
    private static func workingDirectory(in events: [TranscriptEvent]) -> FeedPath {
        let cwd = events.reversed().compactMap { event -> String? in
            guard case let .cwd(path) = event else { return nil }
            return path
        }.first
        return FeedPath(cwd: cwd)
    }

    /// A call's result is read through its id rather than by position: the two events are written
    /// by two different records, and a run of parallel calls interleaves them.
    private static func outcomes(in events: [TranscriptEvent]) -> [String: ToolCallOutcome] {
        events.reduce(into: [:]) { found, event in
            guard case let .toolCallOutcome(outcome) = event else { return }
            found[outcome.id] = outcome
        }
    }

    /// The `switch` carries no `default`, so an event kind added to the domain fails this build
    /// rather than being silently dropped by the surface that should have drawn it.
    private static func content(
        of event: TranscriptEvent,
        answeredBy outcomes: [String: ToolCallOutcome],
        within path: FeedPath,
    )
        -> FeedRow.Content? {
        switch event {
        case let .prompt(text, _): .prompt(text)
        case let .message(markdown): .message(markdown)
        // A separate case from `.message` on purpose, and it stays separate: the two carry the
        // same words often enough that collapsing them would read a turn's reasoning as its answer.
        case let .thought(markdown): .thought(markdown)
        case let .toolCall(call):
            FeedCallReading.call(call, outcome: outcomes[call.id], within: path)
                .map(FeedRow.Content.call)
        // An outcome is not news of its own — it is what the call it answers produced, and that
        // call's row already carries it.
        case .toolCallOutcome, .recordIdentity, .headLeaf, .title, .cwd, .model, .branch,
             .turnEnded, .plan, .compaction, .unreadableLine: nil
        }
    }

    /// Two files of the same name take the shortest parent that tells them apart — the roster's
    /// rule for two workspaces, shared (#419). Computed over the WHOLE feed rather than per row,
    /// because whether a name is ambiguous is a fact about the feed it sits in, not about the file.
    private static func toldApart(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        let labels = DistinguishingLabel.labels(for: contents.map(path(in:)))
        return zip(contents, labels).map { content, label in qualified(content, as: label) }
    }

    private static func path(in content: FeedRow.Content) -> String? {
        guard case let .call(call) = content,
              case let .file(file) = call.subject else { return nil }
        return file.path
    }

    private static func qualified(_ content: FeedRow.Content, as label: String?) -> FeedRow
        .Content {
        guard case let .call(call) = content, case let .file(file) = call.subject, let label
        else { return content }
        return .call(call.naming(file.qualified(as: label)))
    }
}

extension FeedProjection {
    /// The preview transcript, already projected — the one place every specimen and `#Preview`
    /// takes its rows from, so none of them can be looking at a different feed.
    static let previewRows = rows(from: CockpitPresentation.Session.previewTranscript)

    /// The same feed with the prose taken out. A render of the call vocabulary that is four fifths
    /// paragraphs is a render of the paragraphs — this is a filter over the shipping rows, never a
    /// second set of them.
    static let previewCallRows = previewRows.filter(\.isCall)

    /// The same feed with the work taken out — what the agent SAID, at the shape it said it in. A
    /// render of a transcript that is four fifths tool calls is a render of the tool calls.
    static let previewProseRows = previewRows.filter { !$0.isCall }

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

    /// The shot the record kept no bytes for, alone — the state the full gallery buries at the end
    /// of a row and the one a reader has to be able to tell from a picture that failed to load.
    static let previewAbsentShotRows = gallery(of: previewShots.filter { !$0.isOpenable })

    private static func gallery(of shots: [FeedShot]) -> [FeedRow] {
        shots.isEmpty ? [] : [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
    }

    /// The failed call in that feed — the row every surface showing an OPEN panel opens on, so a
    /// specimen and a `#Preview` cannot be looking at two different failures.
    static let previewFailedCallID = previewRows.first { row in
        guard case let .call(call) = row.content else { return false }
        return call.ending.hasFailed
    }?.id
}
