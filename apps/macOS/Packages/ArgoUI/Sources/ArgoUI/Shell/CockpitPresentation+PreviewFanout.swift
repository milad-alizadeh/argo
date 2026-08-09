import ArgoEngine

extension CockpitPresentation.Session {
    /// The three things a turn does that are not work or prose: it hands work to other agents, it
    /// asks somebody a question, and it gets punctuated.
    ///
    /// Written as engine events like the rest of the fixture. Two subagents are left UNANSWERED on
    /// purpose — a delegation the record has not answered is a child still working, which is the
    /// state the rail exists for — and the third reports what it spent, which is the only place a
    /// sidechain's cost is ever visible.
    static let fannedOut: [TranscriptEvent] = [
        .toolCall(ToolCall(
            id: "fan-research", name: "Task", kind: .delegate,
            target: "Research: how the study inks an attention row",
            narration: "Research: how the study inks an attention row", atMs: nil,
        )),
        .toolCall(ToolCall(
            id: "fan-verify", name: "Task", kind: .delegate,
            target: "Verify: the fold breaks at every mark",
            narration: "Verify: the fold breaks at every mark", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "fan-verify",
            status: .completed,
            result: nil,
            endedAtMs: nil,
            usage: Usage(
                inputTokens: 3600,
                outputTokens: 40000,
                cacheReadTokens: 100_000,
                cacheCreationTokens: 0,
            ),
        )),
        .toolCall(ToolCall(
            id: "fan-sweep", name: "Task", kind: .delegate,
            target: "Sweep: every surface that reads a stop reason",
            narration: "Sweep: every surface that reads a stop reason", atMs: nil,
        )),
        // A question already settled, and the answer that settled it. The answer is prose the host
        // wrote, exactly as one arrives — naming the option rather than being it.
        .toolCall(ToolCall(
            id: "ask-settled", name: ToolCall.askUserQuestion, kind: .other,
            target: nil, atMs: nil,
            ask: Ask(questions: [Ask.Question(
                text: "Where should a subagent's spend be drawn?",
                options: ["Labelled on the chip", "Moved to hover"],
            )]),
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "ask-settled",
            status: .completed,
            result: .output(OutputEvidence(
                tier: .direct,
                text: "Your questions have been answered: \"Where should a subagent's spend be "
                    + "drawn?\"=\"Labelled on the chip\"",
            )),
            endedAtMs: nil,
            usage: nil,
        )),
        // What the turn itself cost, beside what it paid other agents to work. Both grains are in
        // the fixture because the roll-up at the foot of the reading claims to be the total of
        // them, and a render of that claim over one grain would not be a render of it.
        .usage(Usage(
            inputTokens: 5000,
            outputTokens: 120,
            cacheReadTokens: 80000,
            cacheCreationTokens: 0,
        )),
        .compaction(atMs: 1_733_000_100_000),
        .message(
            markdown: "The rail is filled from the same reading that decides whether it appears "
                + "at all, so a column standing empty over \"2 running\" is not a state this deck "
                + "has.",
        ),
        .turnEnded(.endTurn),
        // Left waiting, and it is the last thing in the reading: the state somebody is being
        // waited on in is the one the feed has to be judged in.
        .toolCall(ToolCall(
            id: "ask-waiting", name: ToolCall.askUserQuestion, kind: .other,
            target: nil, atMs: nil,
            ask: Ask(questions: [Ask.Question(
                text: "Which reading should the roll-up sum — the turns, or every call that "
                    + "reported a spend?",
                options: [
                    "Every call that reported one",
                    "The turns alone",
                    "Both, side by side",
                ],
            )]),
        )),
    ]
}
