import ArgoEngine

/// One shell call this fixture writes: what the agent said about it, what ran, and what it printed.
/// The three travel together — pairing a command with somebody else's output would put a screenshot
/// on the PR showing the opposite of what its caption claims.
private struct ShellCall {
    /// `nil` for the host that narrates nothing.
    let said: String?
    let ran: String
    let printed: String
}

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

    /// What the turn did once it had looked. Neither is in the count above, and that is the claim:
    /// a chain is unrecognised by construction, and a `git push` is on no allowlist under any
    /// reading of it.
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
                .toolCallOutcome(finished(id, .output(OutputEvidence(
                    tier: .direct, text: call.printed,
                )))),
            ]
        }
    }

    private static func finished(_ id: String, _ result: ToolResult?) -> ToolCallOutcome {
        ToolCallOutcome(id: id, status: .completed, result: result, endedAtMs: nil, usage: nil)
    }
}
