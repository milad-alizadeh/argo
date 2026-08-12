import Foundation

/// Two bursts of keystrokes that have to reach the CLI as SEPARATE reads, and what to leave
/// between them.
///
/// A TUI reads its input in batches, and everything in one read is one batch: keystrokes written
/// together are handled together, whatever they would mean apart. Argo has met that twice — a walk
/// along the mode ring folding into a single step (#653), and the Return after a paste being eaten
/// by the popup the paste itself opened (#682). The pause is the whole mechanism, so it travels
/// with the keystrokes rather than being left to whoever writes them.
struct PacedKeystrokes {
    let first: String
    let second: String
    let gap: Duration
}
