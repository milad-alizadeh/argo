import ArgoEngine
import ArgoUI

// The waiting ask, in each shape a call can put one (#712). Every state is drawn through the
// SHIPPING projection with a live question handed in, so a render here is the row the cockpit
// draws rather than a second spelling of it.

package extension FeedProjection {
    /// One question, three options — the shape a call takes when it wants a decision.
    static let previewAskOneOf = askRows(previewAskDecision)

    /// Boxes, with the field already open beside them: ticking two and adding a word is one answer,
    /// not two acts.
    static let previewAskManyOf = askRows([Ask.Question(
        text: "Which quality gates should run before the PR opens?",
        options: Ask.Option.labelled([
            "SwiftFormat and SwiftLint",
            "Package boundaries",
            "The full Swift test suite",
            "Duplication",
        ]),
        allowsMultiple: true,
    )])

    /// Nothing to click, so the row is its own field.
    static let previewAskFreeForm = askRows([Ask.Question(
        text: "What should I call the roll-up?",
        options: [],
    )])

    /// Two questions in one call — ONE ground and one mark each. Drawn as two cards they would put
    /// a seam through a single stop, which is the whole reason this render exists.
    static let previewAskTwoQuestions = askRows([
        Ask.Question(
            text: "Where should the ask take its answer?",
            options: Ask.Option.labelled([
                "In the feed, where it was asked",
                "In the composer's slot",
            ]),
        ),
        Ask.Question(
            text: "What does esc do on an ask?",
            options: Ask.Option.labelled([
                "Nothing — an ask has no refusal",
                "Clears the selection",
            ]),
        ),
    ])

    /// The same question on a Session Argo cannot drive (#546). The row is a READING and says so
    /// twice over: no cards, no field, and no attention either — nothing done here reaches the
    /// agent, so nothing is waiting on the user. The reason takes the deck's foot instead.
    static let previewAskUnavailable = rows(
        from: askTranscript(previewAskDecision),
        asking: FeedAskProjection.Asking(live: nil, isDriveable: false),
    )

    /// A DRIVEABLE Session whose gate has not raised this question — Argo restarted under a CLI
    /// still holding it. It keeps the attention ground because it is genuinely still waiting, and
    /// draws no cards because there is nothing to answer through.
    static let previewAskUnreached = rows(from: askTranscript(previewAskDecision))

    /// The question Argo's gate is holding that the record does not carry (#1190) — the work
    /// stops mid-column and the row arrives beside the stream rather than out of it.
    ///
    /// The transcript is the one above with its LAST event dropped: the `AskUserQuestion` call
    /// itself, which is the whole specimen. What it settles is that the standing row draws exactly
    /// as `previewAskOneOf` does — what the row IS does not depend on which side of the join it
    /// came from.
    static let previewAskStanding = rows(
        from: Array(askTranscript(previewAskDecision).dropLast()),
        asking: FeedAskProjection.Asking(
            live: FeedAskProjection.Live(
                sessionID: "session-preview",
                askID: previewAskID,
                ask: Ask(questions: previewAskDecision),
            ),
            isDriveable: true,
        ),
    )

    /// A question the agent raised over the COMPANION PLUGIN rather than at Argo's gate (#1205).
    ///
    /// Beside `previewAskStanding` because the pair is the whole judgement: the same words at the
    /// foot of the same work, one of them Argo's own and pressable, this one a reading that says
    /// where it came from and where an answer can go. If the two are hard to tell apart on screen,
    /// the row is drawing a false DIRECT.
    ///
    /// The channel carries one flat question and bare labels, so the render is the shape the
    /// plugin can actually produce — no detail lines under the options, because it has no field
    /// for them.
    static let previewAskReported = rows(
        from: Array(askTranscript(previewAskDecision).dropLast()),
        reported: CompanionAsk(
            id: "call-preview",
            question: "Issue #721 doesn't exist. Which ticket should I implement?",
            options: [
                "#712 — Answer an AskUserQuestion in the cockpit",
                "#713 — PlanPill shows the system focus ring on a click",
                "#711 — Read a Session's subagent transcripts",
            ],
        ).ask,
    )

    /// The same one-of question once the record has settled it — the FOLD (#1207). The offer goes
    /// and one row under the question carries the way it went, so a settled ask stops costing the
    /// vertical a waiting one does.
    ///
    /// Beside `previewAskOneOf` on purpose: the pair is the whole judgement of the ticket, and the
    /// two rows are only comparable drawn over the same work at the same width.
    static let previewAskAnswered = answeredRows(
        previewAskDecision,
        "#713 — PlanPill shows the system focus ring on a click",
    )

    /// The state that reaches the screen for the FIRST time: an answer that named none of the
    /// options, and a free-form question that offered none to name.
    ///
    /// Before the fold neither was drawn at all — `chosen(in:)` matched nothing, so every offer
    /// stayed full-length and unquieted and the answer appeared nowhere. The mark is
    /// `ArgoSymbol.answered` and not a tick, because a tick over words nobody offered claims a pick
    /// that never happened.
    static let previewAskAnsweredUnnamed = answeredRows(
        previewAskDecision,
        "None of those — I opened #722 for it instead.",
    )

    /// The free-form half of the same first: what somebody typed, on screen at last.
    static let previewAskAnsweredFreeForm = answeredRows(
        [Ask.Question(text: "What should I call the roll-up?", options: [])],
        "The delivery digest",
    )

    /// The question under the work that led to it, with what came back — the settled reading, built
    /// through the SHIPPING projection so a render here is the row the cockpit draws.
    private static func answeredRows(_ questions: [Ask.Question], _ answer: String) -> [FeedRow] {
        rows(from: askTranscript(questions) + [
            .toolCallOutcome(ToolCallOutcome(
                id: previewAskID,
                resolution: ToolCallOutcome.Resolution(
                    status: .completed,
                    result: .output(OutputEvidence(tier: .direct, text: answer)),
                    endedAtMs: nil,
                ),
            )),
        ])
    }

    /// The Session those renders are drawn for, blocked on the one-of question.
    internal static let previewAskWaiting = SessionAsk(
        id: previewAskID,
        ask: Ask(questions: previewAskDecision),
    )

    /// The four waiting rows alone, for the preview that judges them side by side.
    internal static let previewWaitingAsks = [
        previewAskOneOf, previewAskManyOf, previewAskFreeForm, previewAskTwoQuestions,
    ].compactMap { feed in
        feed.compactMap { row -> FeedAsk? in
            guard case let .ask(ask) = row.content else { return nil }
            return ask
        }.first
    }

    private static let previewAskID = "ask-preview"

    private static let previewAskDecision = [Ask.Question(
        text: "Issue #721 doesn't exist. Which ticket should I implement?",
        options: [
            Ask.Option(
                label: "#712 — Answer an AskUserQuestion in the cockpit",
                detail: "Open, closest to this worktree.",
            ),
            Ask.Option(
                label: "#713 — PlanPill shows the system focus ring on a click",
                detail: "Open, the other recent one.",
            ),
            Ask.Option(
                label: "#711 — Read a Session's subagent transcripts",
                detail: "Open, unrelated to this worktree.",
            ),
        ],
    )]

    /// The question waiting, under the work that led to it — the reading a render has to be judged
    /// in, since the row's whole promise is that it interrupts a column rather than replacing one.
    private static func askRows(_ questions: [Ask.Question]) -> [FeedRow] {
        rows(
            from: askTranscript(questions),
            asking: FeedAskProjection.Asking(
                live: FeedAskProjection.Live(
                    sessionID: "session-preview",
                    askID: previewAskID,
                    ask: Ask(questions: questions),
                ),
                isDriveable: true,
            ),
        )
    }

    private static func askTranscript(_ questions: [Ask.Question]) -> [TranscriptEvent] {
        [
            .prompt(text: "implement 721", images: [], atMs: nil),
            .message(markdown: "There is no issue #721 in `milad-alizadeh/argo` — the API returns "
                + "404, and the highest number that exists is 713. So I can't start without "
                + "knowing which ticket you mean."),
            .toolCall(ToolCall(
                id: "read-agents", name: "Read", kind: .read, target: "AGENTS.md", atMs: nil,
            )),
            .toolCall(ToolCall(
                id: "ran", name: "Bash", kind: .execute,
                target: "gh api repos/milad-alizadeh/argo/issues/721", atMs: nil,
            )),
            .toolCall(ToolCall(
                id: previewAskID, name: ToolCall.askUserQuestion, kind: .other,
                target: nil, atMs: nil, ask: Ask(questions: questions),
            )),
        ]
    }
}
