import ArgoEngine

extension TranscriptFixtures {
    /// The three things a turn does that are not work or prose: it hands work to other agents, it
    /// asks somebody a question, and it gets punctuated.
    ///
    /// Two subagents are left UNANSWERED on purpose — a delegation the record has not answered is a
    /// child still working — and the third reports what it spent, the only place a sidechain's cost
    /// is ever visible.
    static let fannedOut: [TranscriptEvent] = [
        // The two unanswered ones carry a handover time, because that is what their chips count up
        // from: a running Agent has reported no total for the rail to draw instead.
        .toolCall(ToolCall(
            id: "fan-research", name: "Task", kind: .delegate,
            target: "Research: how the study inks an attention row",
            narration: "Research: how the study inks an attention row",
            atMs: handedOver(214),
        )),
        .toolCall(ToolCall(
            id: "fan-verify", name: "Task", kind: .delegate,
            target: "Verify: the fold breaks at every mark",
            narration: "Verify: the fold breaks at every mark", atMs: handedOver(186),
        )),
        // The one delegation here that named its Subagent, because it is the one the record
        // answered: the id arrives with the result. It is what makes this chip the selectable one
        // in the rail — see `AgentsRailFixture`.
        .toolCallOutcome(spent(
            "fan-verify",
            Usage(
                inputTokens: 3600,
                outputTokens: 40000,
                cacheReadTokens: 100_000,
                cacheCreationTokens: 0,
            ),
            subagent: AgentsRailFixture.verifierID,
            reportedMs: 223_591,
        )),
        .toolCall(ToolCall(
            id: "fan-sweep", name: "Task", kind: .delegate,
            target: "Sweep: every surface that reads a stop reason",
            narration: "Sweep: every surface that reads a stop reason",
            atMs: handedOver(97),
        )),
        // A question already settled, and the answer that settled it. The answer is prose the host
        // wrote, exactly as one arrives — naming the option rather than being it.
        .toolCall(ToolCall(
            id: "ask-settled", name: ToolCall.askUserQuestion, kind: .other,
            target: nil, atMs: nil,
            ask: Ask(questions: [Ask.Question(
                text: "Where should a subagent's spend be drawn?",
                options: Ask.Option.labelled(["Labelled on the chip", "Moved to hover"]),
            )]),
        )),
        .toolCallOutcome(printed(
            "ask-settled",
            "Your questions have been answered: \"Where should a subagent's spend be "
                + "drawn?\"=\"Labelled on the chip\"",
        )),
        // What the turn itself cost, beside what it paid other agents to work. Both grains are in
        // the fixture because the roll-up at the foot of the reading claims to be their total.
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
                options: Ask.Option.labelled([
                    "Every call that reported one",
                    "The turns alone",
                    "Both, side by side",
                ]),
            )]),
        )),
    ]
}
