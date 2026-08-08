import ArgoEngine

public extension CockpitPresentation.Session {
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
        .message(markdown: "Landed. `ArgoFeedRow` holds all four, and no view spells a number."),
    ]
}
