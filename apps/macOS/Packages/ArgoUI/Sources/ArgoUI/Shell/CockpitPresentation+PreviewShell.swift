import ArgoEngine

extension CockpitPresentation.Session {
    /// A stretch of a Codex Session: shell calls, and nothing narrating them.
    ///
    /// Its own fixture rather than a filter over the preview transcript, because it is a different
    /// HOST. Across 20 Codex Sessions and 495 shell calls the argument keys are only ever
    /// `cmd · workdir · yield_time_ms · max_output_tokens · tty` — there is no description and no
    /// equivalent, ever, so a feed of un-narrated commands is not a slice of a Claude Code feed. It
    /// is what that CLI actually produces, and Claude Code falls back to it too.
    ///
    /// Eight commands that would all have opened on the same scratchpad path, chosen for the cuts
    /// they land on: an assignment, a `cd` prelude, a chain that must survive whole, a pipeline, a
    /// path only a middle cut can keep both ends of, and a failure.
    static let ranCommands: [TranscriptEvent] = [
        // Outside the tree on purpose: a path under the Session's own cwd is already short, and the
        // one this exists for is the scratchpad on another volume that no cwd can shorten.
        .cwd("/Users/milad/Developer/argo"),
    ] + printed + [
        // The one that failed, last, so the ink it takes is judged against seven rows that did not.
        .toolCall(ToolCall(
            id: "ran-failed", name: "shell", kind: .execute,
            target: "swiftformat --lint Packages/ArgoUI/Sources", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "ran-failed",
            status: .failed,
            result: .output(OutputEvidence(
                tier: .direct,
                text: "Source input did not pass lint check.\n"
                    + "FeedCommandLine.swift:31:1: warning: (indent) Indent code in accordance "
                    + "with the scope level.",
            )),
            endedAtMs: nil,
            usage: nil,
        )),
    ]

    /// Each command with what it printed, written as the pair a transcript writes — an emitted
    /// call, and the outcome that answers it some records later.
    private static let printed: [TranscriptEvent] = [
        (
            ran: "ARGO_SPECIMEN=feedCommands ARGO_WINDOW_SIZE=960x600 sh scripts/screenshot.sh "
                + "/private/tmp/claude-501/-Users-milad-Developer-argo-worktrees-470/feed.png",
            said: "Wrote feed.png (960 × 600)",
        ),
        (
            ran: "cd apps/macOS && swift build --package-path Packages/ArgoUI",
            said: "Build complete! (16.49s)",
        ),
        (
            ran: "rg -n 'FeedCommandLine' Packages --glob '*.swift'",
            said: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallSubject.swift:46",
        ),
        (
            ran: "swift test --package-path Packages/ArgoUI 2>&1 | grep -E 'Test run with'",
            said: "Test run with 270 tests in 34 suites passed after 0.315 seconds.",
        ),
        (
            ran: "jq -r '.toolUseResult | keys' /private/tmp/claude-501/"
                + "-Users-milad-Developer-argo-worktrees-470/session.jsonl",
            said: "[\n  \"stdout\",\n  \"stderr\",\n  \"interrupted\"\n]",
        ),
        (
            ran: "gh issue view 470 --repo milad-alizadeh/argo",
            said: "A command with no narration is still readable\nOPEN",
        ),
        (
            ran: "git add -A && git commit -m 'A command with no narration is still readable'",
            said: "[argo/#470 4f2a1c9] A command with no narration is still readable",
        ),
    ].enumerated().flatMap { position, call -> [TranscriptEvent] in
        let id = "ran-\(position)"
        return [
            .toolCall(ToolCall(id: id, name: "shell", kind: .execute, target: call.ran, atMs: nil)),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                status: .completed,
                result: .output(OutputEvidence(tier: .direct, text: call.said)),
                endedAtMs: nil,
                usage: nil,
            )),
        ]
    }
}
