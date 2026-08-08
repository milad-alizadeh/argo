import ArgoEngine

extension FeedEvidence {
    /// Whether a prose reading is on the table at all: at least one step is a markdown patch.
    ///
    /// A patch and never an output. A `Read`'s output arrives with the host's line numbers written
    /// into the text, and drawing `    12\t## What I found` through a markdown renderer produces a
    /// document that is not the file — the record has to be a patch for the after-side to be the
    /// characters of the document and nothing else.
    var offersProse: Bool {
        !prosePatches.isEmpty
    }

    /// Which reading the panel opens in.
    ///
    /// A file the agent WROTE opens as the document: its patch is the whole of it, every line an
    /// addition, and there is no change in it to read. Anything else opens as the patch, because a
    /// modification is a claim about what CHANGED and the rendered document has nowhere to put the
    /// half that was taken out. The other reading is always one control away.
    var opening: EvidenceReading {
        offersProse && prosePatches.allSatisfy { $0.change == .create } ? .prose : .source
    }

    private var prosePatches: [DiffEvidence] {
        steps.compactMap { step in
            guard case let .diff(diff) = step.result,
                  (step.language ?? language) == .markdown
            else { return nil }
            return diff
        }
    }
}
