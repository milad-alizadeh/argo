import ArgoEngine

extension FeedEvidence {
    /// Whether a document reading is on the table at all: at least one step is a markdown file.
    /// Never on a FAILED panel — a sentence saying Argo could not read a `SKILL.md` is not a
    /// document, and a renderer would eat whatever punctuation it happens to carry.
    var offersProse: Bool {
        !documents.isEmpty
    }

    /// Which reading the panel opens in. The document, where every markdown step in it HAS a whole
    /// document to draw: a file that was printed, and a file the agent wrote, whose patch is the
    /// whole of it. A modification opens as the patch instead, since the rendered document has
    /// nowhere to put the half that was taken out.
    var opening: EvidenceReading {
        !documents.isEmpty && !documents.contains(false) ? .prose : .source
    }

    /// One per markdown step a document reading is about, `true` where the WHOLE of that document
    /// is there to draw.
    private var documents: [Bool] {
        ending.hasFailed ? [] : steps.compactMap(Self.document)
    }

    /// `nil` for a step no document reading is about: anything but markdown, a picture, and text
    /// that is not the file itself — a sentence about the call is not a document.
    private static func document(_ step: Step) -> Bool? {
        guard step.language == .markdown else { return nil }
        switch step.result {
        // Every line an addition: the file as a whole is what the patch is.
        case let .diff(diff): return diff.change == .create
        case let .output(output):
            guard step.holdsTheFile else { return nil }
            let listing = EvidenceListing.read(output.text)
            // A read prints the file with nothing taken out — but a read that started partway
            // through prints a slice, and a slice has to keep the numbers saying which.
            return listing.isRenderable ? listing.opensTheFile : nil
        case .media: return nil
        }
    }
}
