import ArgoEngine

extension FeedEvidence {
    /// Whether a prose reading is on the table at all: at least one step is a markdown patch.
    ///
    /// A patch and never an output: a `Read`'s output arrives with the host's line numbers written
    /// into the text, so `    12\t## What I found` through a markdown renderer is not the file.
    var offersProse: Bool {
        !prosePatches.isEmpty
    }

    /// Which reading the panel opens in. A file the agent WROTE opens as the document — its patch
    /// is the whole of it, every line an addition. Anything else opens as the patch, since the
    /// rendered document has nowhere to put the half that was taken out.
    var opening: EvidenceReading {
        offersProse && prosePatches.allSatisfy { $0.change == .create } ? .prose : .source
    }

    private var prosePatches: [DiffEvidence] {
        steps.compactMap { step in
            guard case let .diff(diff) = step.result, step.language == .markdown else { return nil }
            return diff
        }
    }
}
