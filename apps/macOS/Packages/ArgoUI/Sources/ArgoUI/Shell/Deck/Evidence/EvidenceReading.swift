import ArgoEngine

/// Which way the panel reads a patch it could read two ways.
///
/// Only markdown has two. Every other language IS its source — a rendered Swift file is a Swift
/// file — but a markdown patch is a document written in a notation, and the notation is the part
/// the reader mostly does not want. A spec the agent just wrote is 161 lines of `##` and backticks
/// under a gutter, when the thing worth looking at is the spec.
enum EvidenceReading: Equatable, Sendable {
    /// The patch, as the record carries it: hunks, the host's line numbers, both sides.
    case source
    /// The document the patch made — its AFTER side, drawn with the shape the markup asked for.
    case prose
}

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
