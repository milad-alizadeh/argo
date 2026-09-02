import ArgoEngine

extension TranscriptFixtures {
    /// A stretch of a Codex Session: shell calls, and nothing narrating them.
    ///
    /// A different HOST, so its own fixture: across 20 Codex Sessions and 495 shell calls the
    /// argument keys are only ever `cmd · workdir · yield_time_ms · max_output_tokens · tty` — no
    /// description, ever.
    ///
    /// Nine commands chosen for the cuts they land on: an assignment, a `cd` prelude, a chain that
    /// must survive whole, a pipeline, a path only a middle cut keeps both ends of, and a failure.
    package static let ranCommands: [TranscriptEvent] = [
        // Outside the tree on purpose: a path under the Session's own cwd is already short, and
        // this exists for the scratchpad no cwd can shorten.
        .cwd("/Users/milad/Developer/argo"),
    ] + printed + [
        // The one that failed, last, beside eight rows that did not.
        .toolCall(ToolCall(
            id: "ran-failed", name: "shell", kind: .execute,
            target: "swiftformat --lint Packages/ArgoUI/Sources", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "ran-failed",
            resolution: ToolCallOutcome.Resolution(
                status: .failed,
                result: .output(OutputEvidence(
                    tier: .direct,
                    text: "Source input did not pass lint check.\n"
                        + "FeedCommandLine.swift:31:1: warning: (indent) Indent code in accordance "
                        + "with the scope level.",
                )),
                endedAtMs: nil,
            ),
        )),
    ]

    /// The same stretch with one more command still running: a call the record has not answered
    /// yet, which is exactly how a transcript mid-Turn ends.
    package static let runningCommand: [TranscriptEvent] = ranCommands + [
        .toolCall(ToolCall(
            id: "ran-running", name: "shell", kind: .execute,
            target: "rtk err bun run quality:swift", atMs: nil,
        )),
    ]

    /// Each command with what it printed, as the pair a transcript writes — a call, and the outcome
    /// that answers it some records later.
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
        (ran: "swiftlint lint --strict Packages/ArgoUI/Sources", said: linted),
    ].enumerated().flatMap { position, call -> [TranscriptEvent] in
        let id = "ran-\(position)"
        return [
            .toolCall(ToolCall(id: id, name: "shell", kind: .execute, target: call.ran, atMs: nil)),
            .toolCallOutcome(printed(id, call.said)),
        ]
    }

    /// The one command here printing more than a reader takes in at a glance — the length a
    /// collapsed row is judged at.
    ///
    /// The filenames in it are verbatim from when it was captured, and stay that way through any
    /// rename in this tree: what is judged here is how a wall of output collapses, and editing the
    /// text moves the pixels the specimen is compared against.
    private static let linted = """
    Linting Swift files in Packages/ArgoUI/Sources
    Linting 'CockpitPresentation+PreviewShell.swift' (1/214)
    Linting 'EvidenceLength.swift' (2/214)
    Linting 'EvidencePanel.swift' (3/214)
    Linting 'EvidenceStepHeader.swift' (4/214)
    Linting 'FeedCall.swift' (5/214)
    Linting 'FeedCallLine.swift' (6/214)
    Linting 'FeedCallReading.swift' (7/214)
    Linting 'FeedCommandLine.swift' (8/214)
    Linting 'FeedGallery.swift' (9/214)
    Linting 'FeedShotView.swift' (10/214)
    EvidencePanel.swift:52:9: error: File Length Violation: File should contain 175 lines
    FeedCallLine.swift:31:5: error: Closure Body Length Violation: Closure body should span 50
    Done linting! Found 2 violations, 2 serious in 214 files.
    """
}
