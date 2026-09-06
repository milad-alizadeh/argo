import ArgoUI

// The two prompts that run past the fold. Every prompt in the shipping preview stands whole, so
// none of them could reach the state #946 was filed about — and the moderate one here unfolds
// correctly, which is why #1287 needs one several times past it.

extension FeedProjection {
    /// A prompt long enough to be folded, with the agent's answer under it.
    static let previewLongPromptRows = numbered([
        .prompt(text: longPromptText, shots: []),
        .message("The bubble's ceiling and its fold are both decided in the layout pass now."),
    ])

    /// That prompt's row, which a still opens unfolded.
    static let previewLongPromptID = previewLongPromptRows.first { $0.kind.isPrompt }?.id

    /// A prompt several times past that one, with the agent's answer under it (#1287).
    static let previewHugePromptRows = numbered([
        .prompt(text: hugePromptText, shots: []),
        .message("The bubble stands at whatever the reader unfolded it to."),
    ])

    /// That prompt's row, which a still opens unfolded or crosses the fold on
    /// (`SpecimenScene.PromptFold`).
    static let previewHugePromptID = previewHugePromptRows.first { $0.kind.isPrompt }?.id

    /// Numbered paragraphs rather than one sentence repeated: a prompt that wraps identically on
    /// every line is the one shape in which a wrapping fault cannot be seen, and the numbers say
    /// at a glance how much of the prompt a still is actually showing.
    static let hugePromptText = (1 ... hugePromptParts)
        .map { "Part \($0) of \(hugePromptParts). " + longPromptText }
        .joined(separator: " ")

    /// How many times over the moderate prompt the huge one runs. Big enough that its row is a
    /// couple of hundred lines and tens of thousands of points tall — the size a prompt reaches
    /// once a file has been pasted into it, and the size #1287 was reported at.
    ///
    /// A still of it needs `ARGO_SETTLE_SECONDS`: the deck draws nothing until its measure lands
    /// (ADR-0030, Rule 3), and this one takes about two seconds to get there.
    private static let hugePromptParts = 120

    private static let longPromptText =
        "Read the whole anatomy study before you start, then take the feed's prompt "
            + "bubble apart and tell me what decides its height. I want the two measurements "
            + "named, where each of them is taken, and which of them the table caches — and if "
            + "the answer is that one of them arrives a frame after the other, say so plainly "
            + "rather than describing the code as though it agreed with its own comments. "
            + "Then do the same for the control under the words: say what decides whether it "
            + "is drawn at all, at which measure that is decided, and what the reader sees "
            + "when the answer changes between the pass that measures the row and the pass "
            + "that draws it. I would rather have the two numbers than a paragraph about "
            + "them, so give me the numbers first and the account of them afterwards."
}
