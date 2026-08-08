import ArgoEngine

extension CockpitPresentation.Session {
    /// A turn as a transcript actually writes one, for the surfaces that read a Session rather
    /// than count one.
    ///
    /// Written as ENGINE events, not as rows: a fixture shaped like a row would be a second way
    /// to build one, and the projection that turns a stream into rows is exactly what the feed's
    /// previews and specimen exist to look at. The kinds this feed does not draw yet are in here
    /// on purpose — a specimen where every event is drawable proves nothing about ignoring one.
    static let previewTranscript: [TranscriptEvent] = [
        .prompt(
            text: "Read the anatomy study before you start, then wire the feed's prose through "
                + "the projection seam. Only the prompt, the message and the thought render — "
                + "every other kind arrives with its own ticket, so ignore them cleanly rather "
                + "than drawing a placeholder where a surface has not been decided yet.",
            atMs: 1_733_000_000_000,
        ),
        .thought(
            markdown: "The study puts prose at a reading measure and reasoning in the same "
                + "shape at a quieter ink. Start from the contract, not from the view.",
        ),
        .message(
            markdown: "Read the anatomy study. The feed is one column of prose at a fixed "
                + "measure, and everything else on the deck is chrome around it.",
        ),
        .plan(Plan(entries: [
            PlanEntry(text: "Land the feed's metrics in the contract", status: .inProgress),
            PlanEntry(text: "Draw the three kinds", status: .pending),
        ])),
        .turnEnded(.endTurn),
        .message(
            markdown: "The type ramp already carries the body role, so the feed needs a rhythm "
                + "group rather than a new face: a row inset, a line height, a row gap, and the "
                + "step between a label and the prose under it.",
        ),
        .thought(markdown: "A wide window should get more feed, never a longer line."),
        .prompt(text: "Good. Land the metrics in the contract.", atMs: 1_733_000_050_000),
    ]
        + workedOn
        + shotsTaken
        + [
            // Written with the shape a CLI actually writes in — a heading, a list, a fenced block,
            // a pipe table, a link and the `code` spans a sentence is half made of. A fixture of
            // flat paragraphs would prove nothing about reading an agent's markdown.
            .message(
                markdown: """
                ## Landed

                `ArgoFeedRow` holds all four metrics, and no view spells a number:

                1. The inset, the gap and the step before prose come off the spacing ladder.
                2. The line height and the measure answer to the type ramp instead.

                ```swift
                public static let inset: CGFloat = ArgoSpacing.section
                // The measure is typographic, not a rung of the ladder.
                ```

                | Ticket | Label | Blocked by |
                |---|---|---|
                | #474 — Read each prose string once | `ready-for-agent` | — |
                | #477 — Confirm the deck moves cleanly | `ready-for-human` | #474 |

                - The contract suite asserts every one of them, per [ADR-0021](https://example.com).
                - The build is green again.
                """,
            ),
        ]
        + fannedOut
}
