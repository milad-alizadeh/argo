import ArgoEngine

/// One call this fixture writes: what the agent said about it, what it named, and what it did —
/// which carries the tool, the kind and the outcome at once, so the shape stays under the house's
/// initializer cap and a case reads as a sentence.
private struct NarratedCall {
    let said: String
    let id: String
    let target: String
    let did: Did

    enum Did {
        case ran
        case ranAndFailed
        /// A skill the agent invoked by name.
        case invoked
        case changed(FileChange)
    }
}

extension TranscriptFixtures {
    /// A Turn at the density a real one reaches: twelve calls over three stretches, every one of
    /// them separated from the next by the agent's own sentence about it.
    ///
    /// The specimen the per-Turn fold is judged against (#1172). `foldedLooking` cannot be: its
    /// calls arrive in unbroken runs, so an adjacency rule and a per-Turn rule fold it identically
    /// and a suite written over it alone would pass with either rule deleted.
    ///
    /// The second Turn is the counter-case, and it is here rather than in a fixture of its own: it
    /// makes one edit and runs one command, so a rule that folded a stretch of one would show up
    /// as two cards that each lost the name of the only call they stood for.
    package static let denseTurn: [TranscriptEvent] = [.cwd("/Users/milad/Developer/argo")]
        + turn(
            asking: "Fold a stretch of work into one feed row",
            reasoning: "Fourteen rows for one Turn's work is fourteen rows to scroll past.",
            doing: dense,
            saying: "The card stands where the first call did, and the sentences stay put.",
        )
        + turn(
            asking: "Now hold the count against the ruler",
            reasoning: nil,
            doing: sparse,
            saying: "One call of a kind keeps its own row.",
        )

    /// The dense Turn's work: seven mutations of three shapes, four commands with one failure
    /// among them, and one skill — three stretches, none of them ever adjacent, and the skill a
    /// stretch of one that must survive as its own row.
    private static let dense: [NarratedCall] = [
        NarratedCall(
            said: "Read the fold's own rule first",
            id: "dense-skill", target: "design-to-code", did: .invoked,
        ),
        NarratedCall(
            said: "Give the card its own type",
            id: "dense-create",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedWork.swift",
            did: .changed(.create),
        ),
        NarratedCall(
            said: "Check it compiles before going further",
            id: "dense-build", target: "swift build --package-path Packages/ArgoUI", did: .ran,
        ),
        NarratedCall(
            said: "Fold the Turn's calls into it",
            id: "dense-edit-fold",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedWorkFold.swift",
            did: .changed(.create),
        ),
        NarratedCall(
            said: "Run the pass over the long reading",
            id: "dense-test", target: "swift test --filter FeedWorkFold", did: .ranAndFailed,
        ),
        NarratedCall(
            said: "The card was standing at the wrong end of the Turn",
            id: "dense-edit-place",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedWorkFold.swift",
            did: .changed(.modify),
        ),
        NarratedCall(
            said: "Answer the new row's height",
            id: "dense-edit-height",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/FeedShapeHeight.swift",
            did: .changed(.modify),
        ),
        NarratedCall(
            said: "And its shape, so the table recycles it apart from a call",
            id: "dense-edit-shape",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/FeedRowShape.swift",
            did: .changed(.modify),
        ),
        NarratedCall(
            said: "The old survey line is the card's own anatomy now",
            id: "dense-delete",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedLegacyFold.swift",
            did: .changed(.delete),
        ),
        NarratedCall(
            said: "Run it again",
            id: "dense-test-again", target: "swift test --filter FeedWorkFold", did: .ran,
        ),
        NarratedCall(
            said: "Draw it",
            id: "dense-edit-line",
            target: "Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedFoldLine.swift",
            did: .changed(.create),
        ),
        NarratedCall(
            said: "Hold the whole suite",
            id: "dense-test-all", target: "swift test --package-path Packages/ArgoUI", did: .ran,
        ),
    ]

    /// The sparse Turn's work: one call of each of two stretches, so neither folds.
    private static let sparse: [NarratedCall] = [
        NarratedCall(
            said: "State the formula the ruler is held against",
            id: "sparse-edit",
            target: "Packages/ArgoUI/Tests/ArgoUITests/FeedShapeHeightTests+Rows.swift",
            did: .changed(.modify),
        ),
        NarratedCall(
            said: "And run it",
            id: "sparse-test", target: "swift test --filter FeedShapeHeight", did: .ran,
        ),
    ]

    private static func turn(
        asking: String,
        reasoning: String?,
        doing: [NarratedCall],
        saying: String,
    )
        -> [TranscriptEvent] {
        [.prompt(text: asking, images: [], atMs: nil)]
            + (reasoning.map { [TranscriptEvent.thought(markdown: $0)] } ?? [])
            + doing.flatMap(written(_:))
            + [.message(markdown: saying), .turnEnded(.endTurn)]
    }

    /// One call as the record writes it: the agent's own sentence about it, then the call, then
    /// the outcome. The sentence is a row of its own and NOT the call's narration — a narration
    /// rides on the call's row and would leave the calls adjacent, which is the one shape this
    /// fixture exists to avoid.
    private static func written(_ call: NarratedCall) -> [TranscriptEvent] {
        [
            .message(markdown: call.said),
            .toolCall(ToolCall(
                id: call.id, name: call.did.tool, kind: call.did.kind,
                target: call.target, atMs: nil,
            )),
            .toolCallOutcome(answered(call)),
        ]
    }

    private static func answered(_ call: NarratedCall) -> ToolCallOutcome {
        switch call.did {
        case .ranAndFailed:
            ToolCallOutcome(
                id: call.id,
                resolution: ToolCallOutcome.Resolution(
                    status: .failed,
                    result: .output(OutputEvidence(
                        tier: .direct,
                        text: "error: 1 test failed in FeedWorkFoldTests",
                    )),
                    endedAtMs: nil,
                ),
            )
        case .ran, .invoked: printed(call.id, "Build complete. 1 target.")
        case let .changed(change): finished(call.id, .diff(patched(change, of: call.target)))
        }
    }

    /// A patch of a size that varies with the file it changed, so no two rows of the card carry
    /// the same figures.
    private static func patched(_ change: FileChange, of target: String) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            mutation: DiffEvidence.Mutation(change: change, destination: nil),
            patch: DiffEvidence.Patch(
                added: change == .delete ? 0 : target.count % 40 + 4,
                removed: change == .create ? 0 : target.count % 11,
                hunks: [DiffHunk(
                    oldStart: 1,
                    newStart: 1,
                    lines: [DiffLine(side: .add, text: "    case let .work(work): folded(work)")],
                )],
            ),
        )
    }
}

private extension NarratedCall.Did {
    /// The tool the host would have named. `Write` for a create and a delete alike: no CLI has a
    /// delete tool, so the patch is what says which it was (`FeedCallReading.mutation`).
    var tool: String {
        switch self {
        case .ran, .ranAndFailed: "Bash"
        case .invoked: "Skill"
        case let .changed(change): change == .modify ? "Edit" : "Write"
        }
    }

    var kind: ToolCallKind {
        switch self {
        case .ran, .ranAndFailed: .execute
        case .invoked: .skill
        case .changed: .edit
        }
    }
}
