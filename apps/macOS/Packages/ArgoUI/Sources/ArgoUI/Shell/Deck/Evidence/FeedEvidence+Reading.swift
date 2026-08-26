import ArgoEngine

extension FeedEvidence {
    /// Whether a prose reading is on the table at all: at least one step is a markdown file.
    ///
    /// A FAILED panel never is, whatever its steps declare. What a failed call printed is a message
    /// about the call — a sentence saying Argo could not read a `SKILL.md` is not a document, and a
    /// renderer would eat whatever punctuation it happens to carry.
    var offersProse: Bool {
        !proseSteps.isEmpty
    }

    /// Which reading the panel opens in. The document, where every markdown step in it HAS a whole
    /// document to draw: a file that was printed, and a file the agent wrote, whose patch is the
    /// whole of it. A modification opens as the patch instead, since the rendered document has
    /// nowhere to put the half that was taken out.
    var opening: EvidenceReading {
        offersProse && proseSteps.allSatisfy(\.self) ? .prose : .source
    }

    /// The steps a prose reading is about — the markdown ones, patches and printed files alike —
    /// each as whether the WHOLE of its document is there to draw.
    private var proseSteps: [Bool] {
        ending.hasFailed ? [] : steps.compactMap(Self.wholeDocument)
    }

    /// `nil` for a step no prose reading is about: anything but markdown, and a picture, which is
    /// not a document however its path is spelled.
    private static func wholeDocument(_ step: Step) -> Bool? {
        guard step.language == .markdown else { return nil }
        switch step.result {
        // Every line an addition: the file as a whole is what the patch is.
        case let .diff(diff): return diff.change == .create
        // A read PRINTS the file, with nothing taken out of it.
        case .output: return true
        case .media: return nil
        }
    }
}
