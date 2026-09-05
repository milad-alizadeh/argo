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
        // The drawn Turn (#1278). Both states, because the whole claim of the swap is that the row
        // stands where the record's own row will: a drawn Turn that measured differently from the
        // prompt beside it here would move the feed the moment the record landed.
        Row(name: "submitted, one line", content: .submitted(text: "Rename the deck")),
        Row(name: "submitted, past the fold", content: .submitted(text: long)),
        Row(name: "submitted, unfolded", content: .submitted(text: long), isUnfolded: true),
    ]

    private static let calls: [Row] = [
        Row(name: "call, answered", content: .call(RowKindFixture.answeredCall)),
        Row(name: "call, still running", content: .call(RowKindFixture.pendingCall)),
        Row(name: "survey, closed", content: .survey(run)),
        Row(name: "survey, listed", content: .survey(run), isUnfolded: true),
        Row(name: "work, closed", content: .work(card)),
        Row(name: "work, listed", content: .work(card), isUnfolded: true),
        Row(name: "gallery, one shot", content: .gallery(RowKindFixture.gallery)),
        Row(name: "gallery, no shots at all", content: .gallery(FeedGallery(shots: []))),
        Row(name: "gallery, a wrapping run", content: .gallery(FeedGallery(
            shots: Array(repeating: RowKindFixture.absentShot, count: 7),
        ))),
    ]

    private static let marks: [Row] = [
        Row(name: "mark, a rule with no words", content: .mark(.turnEnded)),
        Row(name: "mark, compacted", content: .mark(.compacted)),
        Row(name: "mark, handed off", content: .mark(.handedOff(
            FeedHandoff(sessionID: "other", title: "The Session it went to"),
        ))),
        Row(name: "mark, a Permission that expired", content: .mark(.permissionExpired(
            PermissionExpiry(id: "one", toolName: "Bash"),
        ))),
        Row(name: "mark, working", content: .mark(.working)),
        Row(
            name: "a wait that settled",
            content: .settledWait(SessionWaitSettled(wait: .starting, tookMs: 3200)),
        ),
        Row(name: "mark, excerpted", content: .mark(.excerpted)),
        // Both figures on it, which is the widest the ending ever draws (#1281).
        Row(
            name: "a delegation that ended",
            content: .delegationEnded(FeedDelegationEnd(
                subject: .plain("Standards review"),
                ending: .succeeded,
                durationMs: 223_591,
                spend: Usage(
                    inputTokens: 3600,
                    outputTokens: 40000,
                    cacheReadTokens: 100_000,
                    cacheCreationTokens: 0,
                ),
            )),
        ),
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
