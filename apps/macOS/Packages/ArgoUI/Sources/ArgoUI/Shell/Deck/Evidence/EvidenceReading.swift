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

extension EvidenceReading {
    /// The mark for this reading, on the control that switches TO it.
    var symbol: String {
        switch self {
        case .source: ArgoSymbol.readAsSource
        case .prose: ArgoSymbol.readAsProse
        }
    }

    /// What pressing the control offers, for the tooltip and for the ear.
    var invitation: String {
        switch self {
        case .source: "Read the patch"
        case .prose: "Read as a document"
        }
    }
}
