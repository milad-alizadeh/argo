import ArgoEngine

/// One shell call this fixture writes: what the agent said about it, what ran, and what it printed.
private struct ShellCall {
    /// `nil` for the host that narrates nothing.
    package let said: String?
    package let ran: String
    package let printed: String
}

extension TranscriptFixtures {
    /// A turn that looked around — at files and through a shell — then changed something, then said
    /// so: seven quiet calls, a mutation, and two loud commands after it.
    ///
    /// Half the commands are narrated and half are not, on purpose — the fold reads the command
    /// text, so a fixture narrating all of them would render a claim about descriptions instead.
    package static let foldedLooking: [TranscriptEvent] = [.cwd("/Users/milad/Developer/argo")]
        + observation + [
            .toolCall(ToolCall(
                id: "fold-edit", name: "Edit", kind: .edit,
                target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurveyFold.swift",
                narration: nil, atMs: nil,
            )),
            .toolCallOutcome(finished("fold-edit", .diff(DiffEvidence(
                tier: .direct,
                mutation: DiffEvidence.Mutation(change: .modify, destination: nil),
                patch: DiffEvidence.Patch(
                    added: 2,
                    removed: 1,
                    hunks: [DiffHunk(oldStart: 45, newStart: 45, lines: [
                        DiffLine(side: .context, text: "    private static func quiet("),
                        DiffLine(
                            side: .del,
                            text: "        guard case let .call(call) = content,",
                        ),
                        DiffLine(
                            side: .add,
                            text: "        guard case let .call(call) = content,",
                        ),
                        DiffLine(side: .add, text: "              call.onlyLooks,"),
                    ])],
                ),
            )))),
        ] + mutations

    /// The stretch that folds: two files read and five commands that only looked. Five different
    /// shapes, because the allowlist decides which are in the count and five `ls` would not
    /// exercise
    /// it.
    private static let observation: [TranscriptEvent] = opened + shelled([
        ShellCall(
            said: nil,
            ran: "ls Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call",
            printed: "FeedCall.swift\nFeedCallLine.swift\nFeedCommandLine.swift\nFeedSurvey.swift",
        ),
        ShellCall(
            said: "Read the call vocabulary",
            ran: "rtk cat Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCall.swift",
            printed: "struct FeedCall: Equatable, Sendable {\n    let kind: Kind",
        ),
        ShellCall(
            said: nil,
            ran: "rtk cat Packages/ArgoUI/Sources/Deck/Feed/Call/FeedSurvey.swift",
            printed: "struct FeedSurvey: Equatable, Sendable {\n    let calls: [FeedCall]",
        ),
        ShellCall(
            said: "Find every reader of the quiet rule",
            ran: "grep -rn 'isQuiet' Packages",
            printed: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedSurvey.swift:97",
        ),
        ShellCall(
            said: nil,
            ran: "git status",
            printed: "On branch argo/#471-stretch-of-looking\nnothing to commit, working tree "
                + "clean",
        ),
    ])

    /// What the turn did once it had looked. Neither is in the count above: a chain is unrecognised
    /// by construction, and a `git push` is on no allowlist.
    private static let mutations: [TranscriptEvent] = shelled([
        ShellCall(
            said: "Stage and commit the fold change",
            ran: "git add -A && git commit -m 'A stretch of looking costs one row'",
            printed: "[argo/#471 8c1f0a2] A stretch of looking costs one row\n 4 files changed",
        ),
        ShellCall(
            said: "Push to the remote",
            ran: "git push -u origin argo/#471-stretch-of-looking",
            printed: "To github.com:milad-alizadeh/argo.git\n * [new branch] argo/#471",
        ),
    ])

    /// The two files, read the ordinary way — what makes the folded line say `Read 2 · Ran 5`.
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
            .toolCallOutcome(printed(id, file.text)),
        ]
    }

    /// Each command as the pair a transcript writes — an emitted call, and the outcome that answers
    /// it. Every one printed something, so no folded line offers a click onto an empty pane.
    private static func shelled(_ calls: [ShellCall]) -> [TranscriptEvent] {
        calls.flatMap { call -> [TranscriptEvent] in
            // The command itself, because two stretches are built by two calls to this and a
            // position would have given the commit the same id as the `ls` above it.
            let id = "fold-ran-\(call.ran)"
            return [
                .toolCall(ToolCall(
                    // The tool name follows the host: a description is Claude Code's `Bash`, and a
                    // Codex `shell` never carries one.
                    id: id, name: call.said == nil ? "shell" : "Bash", kind: .execute,
                    target: call.ran, narration: call.said, atMs: nil,
                )),
                .toolCallOutcome(printed(id, call.printed)),
            ]
        }
    }
}
