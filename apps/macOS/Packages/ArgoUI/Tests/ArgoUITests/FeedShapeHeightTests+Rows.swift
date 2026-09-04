import ArgoEngine
@testable import ArgoUI

// The rows the shape claim is made over — one per shape, and one per STATE inside a shape that
// changes what it draws: a folded prompt against an unfolded one, a survey the panel is open on, an
// unreadable run let out, a question Argo is holding open against one the record settled.
//
// Every case is a shape the shipping projection produces. What is not here is prose, which
// `FeedTypesetHeightTests` holds against the same ruler over its own corpus.

extension FeedShapeHeightTests {
    static let rows: [Row] = prompts + calls + marks + questions + others

    private static let prompts: [Row] = [
        Row(name: "prompt, one line", content: .prompt(text: "Rename the deck", shots: [])),
        Row(name: "prompt, past the fold", content: .prompt(text: long, shots: [])),
        Row(name: "prompt, unfolded", content: .prompt(text: long, shots: []), isUnfolded: true),
        Row(
            name: "prompt, a picture pasted in",
            content: .prompt(text: "Look at this", shots: [RowKindFixture.absentShot]),
        ),
        Row(name: "prompt, only a picture", content: .prompt(
            text: "", shots: [RowKindFixture.absentShot, RowKindFixture.openableShot],
        )),
    ]

    private static let calls: [Row] = [
        Row(name: "call, answered", content: .call(RowKindFixture.answeredCall)),
        Row(name: "call, still running", content: .call(RowKindFixture.pendingCall)),
        Row(name: "survey, closed", content: .survey(run)),
        Row(name: "survey, open", content: .survey(run), isOpen: true),
        Row(name: "work, closed", content: .work(card)),
        Row(name: "work, open", content: .work(card), isOpen: true),
        Row(name: "gallery, one shot", content: .gallery(RowKindFixture.gallery)),
        Row(name: "gallery, no shots at all", content: .gallery(FeedGallery(shots: []))),
        Row(name: "gallery, a wrapping run", content: .gallery(FeedGallery(
            shots: Array(repeating: RowKindFixture.absentShot, count: 7),
        ))),
    ]

    private static let marks: [Row] = [
        Row(name: "mark, a rule with no words", content: .mark(.turnEnded(.endTurn))),
        Row(name: "mark, compacted", content: .mark(.compacted)),
        Row(name: "mark, a reason", content: .mark(.turnEnded(.maxTokens))),
        Row(name: "mark, handed off", content: .mark(.handedOff(
            FeedHandoff(sessionID: "other", title: "The Session it went to"),
        ))),
        Row(name: "mark, a Permission that expired", content: .mark(.permissionExpired(
            PermissionExpiry(id: "one", toolName: "Bash"),
        ))),
        Row(name: "mark, working", content: .mark(.working)),
        Row(name: "mark, starting", content: .mark(.starting)),
        Row(name: "mark, excerpted", content: .mark(.excerpted)),
    ]

    private static let others: [Row] = [
        Row(name: "skill loaded", content: .skillLoaded(RowKindFixture.skill)),
        Row(
            name: "unreadable, closed",
            content: .unreadable(FeedUnreadable(lines: ["{\"type\":\"assistant\""])),
        ),
        Row(
            name: "unreadable, let out",
            content: .unreadable(FeedUnreadable(lines: [
                "{",
                "[\"content\"",
                "\"role\": \"assist",
            ])),
            isUnfolded: true,
        ),
        Row(name: "message", content: .message("Renamed.")),
        Row(name: "thought", content: .thought("Weighing the two.")),
    ]

    /// A Turn's work with a failure in it, so the header's count and the tinted step are both
    /// drawn — neither adds a line, which is what the open state is held against.
    private static let card = FeedWork(calls: [
        RowKindFixture.answeredCall, RowKindFixture.failedCall, RowKindFixture.answeredCall,
    ])

    /// A run of looking with more than one call, so the list the open state draws has lines to
    /// stack.
    private static let run = FeedSurvey(calls: [
        RowKindFixture.answeredCall, RowKindFixture.answeredCall, RowKindFixture.answeredCall,
    ])

    /// Longer than `ArgoFeedRow.collapsedPromptLines` at every width the suite asks at.
    private static let long = String(
        repeating: "Read the whole anatomy study before you start. ", count: 14,
    )
}
