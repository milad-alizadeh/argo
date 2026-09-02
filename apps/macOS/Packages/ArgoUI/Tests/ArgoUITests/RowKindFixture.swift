import ArgoEngine
@testable import ArgoUI

/// One row of every kind the feed can produce. Hand-listed rather than derived: `FeedRow.Content`
/// has no case list to walk, and the exhaustive `switch` behind `kind` is what actually fails a
/// build when an eleventh kind arrives. Every case must appear here, or every `everyKind` filter
/// silently stops proving anything about the one that is missing.
enum RowKindFixture {
    static let everyKind: [FeedRow.Content] = [
        .prompt(text: "Rename the deck", shots: []),
        .message("Renamed."),
        .thought("Weighing."),
        .call(answeredCall),
        .call(pendingCall),
        .survey(survey),
        .gallery(gallery),
        .skillLoaded(skill),
        .ask(ask),
        .mark(.compacted),
        .unreadable(FeedUnreadable(lines: ["{"])),
    ]

    /// A call the record answered with output — the one that opens the panel.
    static let answeredCall = call(evidence: [
        .output(OutputEvidence(tier: .direct, text: "ok")),
    ], ending: .succeeded)

    /// A call the transcript has not answered yet. It carries no evidence for the same reason: the
    /// result has not been written.
    static let pendingCall = call(evidence: [], ending: .pending)

    static let survey = FeedSurvey(calls: [answeredCall])

    static let gallery = FeedGallery(shots: [absentShot])

    /// A row's shots in the order that makes the choice visible: a press must skip the absence.
    static let anAbsenceThenAPicture = [absentShot, openableShot]

    /// A picture whose bytes genuinely decode — the one shot a press can open.
    static let openableShot = shot(bytes: FeedFixture.onePixelPNG)

    /// A picture the record kept no bytes for. It is IN the row and it opens nothing.
    static let absentShot = shot(bytes: nil)

    static let ask = FeedAsk(ask: Ask(questions: []), isAnswered: false, answer: nil)

    static let skill = FeedSkillLoad(SkillLoad(
        name: "code-review",
        directory: "/Users/x/argo/.claude/skills/code-review",
        body: .read("Two-axis review."),
    ))

    private static func shot(bytes: String?) -> FeedShot {
        FeedShot(
            name: "shot.png",
            address: "/tmp/shot.png",
            media: MediaEvidence(
                tier: .direct,
                mediaType: "image/png",
                bytes: bytes.map { .held($0) },
            ),
        )
    }

    private static func call(
        evidence: [ToolResult],
        ending: FeedCall.Ending,
    )
        -> FeedCall {
        FeedCall(
            kind: .read,
            subject: .plain("Package.swift"),
            churn: nil,
            ending: ending,
            evidence: evidence,
            repeats: 1,
            spend: nil,
        )
    }
}
