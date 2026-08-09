import ArgoEngine

extension CockpitPresentation.Session {
    /// A turn that looked around — at files and through a shell — then changed something, then said
    /// so.
    ///
    /// The state the fold exists for, and the one a count alone cannot be judged on: seven quiet
    /// calls, a mutation, and two loud commands after it. What has to read is that the top of the
    /// turn is ONE line carrying a number, that the line below it is the change the looking was
    /// for, and that the commit and the push under that are still two rows a reader can see.
    ///
    /// Half the commands are narrated and half are not, on purpose. A Claude Code Session and a
    /// Codex one fold by the same rule — it reads the command text — and a fixture narrating all of
    /// them would render a claim about descriptions rather than about the fold.
    static let foldedLooking: [TranscriptEvent] = [.cwd("/Users/milad/Developer/argo")]
        + observation + [
            .toolCall(ToolCall(
                id: "fold-edit", name: "Edit", kind: .edit,
                target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurveyFold.swift",
                narration: nil, atMs: nil,
            )),
            .toolCallOutcome(finished("fold-edit", .diff(DiffEvidence(
                tier: .direct,
                change: .modify,
                destination: nil,
                added: 2,
                removed: 1,
                hunks: [DiffHunk(oldStart: 45, newStart: 45, lines: [
                    DiffLine(side: .context, text: "    private static func quiet("),
                    DiffLine(side: .del, text: "        guard case let .call(call) = content,"),
                    DiffLine(side: .add, text: "        guard case let .call(call) = content,"),
                    DiffLine(side: .add, text: "              call.onlyLooks,"),
                ])],
            )))),
        ] + mutations

    /// The stretch that folds: two files read and five commands that only looked. The commands are
    /// the ones a real turn opens with rather than five of one shape, because the allowlist is what
    /// decides which are in the count and a fixture of five `ls` would never exercise it.
    private static let observation: [TranscriptEvent] = opened + shelled([
        (said: nil, ran: "ls Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call"),
        (
            said: "Read the call vocabulary",
            ran: "rtk cat Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCall.swift",
        ),
        (said: nil, ran: "rtk cat Packages/ArgoUI/Sources/Deck/Feed/Call/FeedSurvey.swift"),
        (said: "Find every reader of the quiet rule", ran: "grep -rn 'isQuiet' Packages"),
        (said: nil, ran: "git status"),
    ])

    /// What the turn did once it had looked. Neither is in the count above, and that is the claim:
    /// a chain is unrecognised by construction, and a `git push` is on no allowlist under any
    /// reading of it.
    private static let mutations: [TranscriptEvent] = shelled([
        (
            said: "Stage and commit the fold change",
            ran: "git add -A && git commit -m 'A stretch of looking costs one row'",
        ),
        (said: "Push to the remote", ran: "git push -u origin argo/#471-stretch-of-looking"),
    ])

    /// The two files, read the ordinary way — what makes the folded line say `Read 2 · Ran 5`
    /// rather than a count of one kind, which is the shape a mixed turn actually produces.
    private static let opened: [TranscriptEvent] = [
        (
            path: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurveyFold.swift",
            text: "    45\t    private static func quiet(_ content: FeedRow.Content)"
                + " -> FeedCall? {",
        ),
        (
            path: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedQuietCommand.swift",
            text: "    17\t    static func onlyLooks(at command: String) -> Bool {",
        ),
    ].enumerated().flatMap { position, file -> [TranscriptEvent] in
        let id = "fold-read-\(position)"
        return [
            .toolCall(ToolCall(id: id, name: "Read", kind: .read, target: file.path, atMs: nil)),
            .toolCallOutcome(finished(id, .output(OutputEvidence(
                tier: .direct, text: file.text,
            )))),
        ]
    }

    private static func shelled(_ calls: [(said: String?, ran: String)]) -> [TranscriptEvent] {
        calls.enumerated().flatMap { position, call -> [TranscriptEvent] in
            let id = "fold-ran-\(position)-\(call.ran.prefix(12))"
            return [
                .toolCall(ToolCall(
                    // The tool name follows the host: a description is Claude Code's `Bash`, and a
                    // Codex `shell` never carries one.
                    id: id, name: call.said == nil ? "shell" : "Bash", kind: .execute,
                    target: call.ran, narration: call.said, atMs: nil,
                )),
                .toolCallOutcome(finished(id, .output(OutputEvidence(
                    tier: .direct, text: outputs[position % outputs.count],
                )))),
            ]
        }
    }

    /// Output with something in it, so every folded call has a result behind the line — a fold that
    /// kept nothing would render a row offering a click onto an empty pane.
    private static let outputs = [
        "FeedCall.swift\nFeedCallLine.swift\nFeedCommandLine.swift\nFeedSurvey.swift",
        "struct FeedCall: Equatable, Sendable {\n    let kind: Kind",
        "On branch argo/#471-stretch-of-looking\nnothing to commit, working tree clean",
        "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurvey.swift:97",
        "[argo/#471 8c1f0a2] A stretch of looking costs one row\n 4 files changed",
    ]

    private static func finished(_ id: String, _ result: ToolResult?) -> ToolCallOutcome {
        ToolCallOutcome(id: id, status: .completed, result: result, endedAtMs: nil, usage: nil)
    }
}
