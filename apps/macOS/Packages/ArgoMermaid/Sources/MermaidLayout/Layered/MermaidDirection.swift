import Foundation

/// Which way a layered diagram's ranks grow. `TD` and `TB` are one direction under two spellings.
///
/// Shared rather than any one reader's, because `MermaidGrain` turns it into points and the grain
/// is
/// the pass's — a state machine written `direction LR` runs the way a flowchart written `LR` does.
enum MermaidDirection: Equatable, Sendable {
    case down, up, right, left

    /// The direction that spelling names, or `nil` for a word that names none.
    static func named(_ word: String) -> Self? {
        switch word.uppercased() {
        case "TD", "TB": .down
        case "BT": .up
        case "LR": .right
        case "RL": .left
        default: nil
        }
    }
}
