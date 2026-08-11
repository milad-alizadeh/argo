import Foundation

/// Why a read did not land — the three cause words the failure spec settled, and no others.
///
/// They are causes *inside* a failing connection, never states of one: the fix is identical for all
/// three (you wait), so rendering them as separate states would draw a distinction nobody can act
/// on. `ConnectionState` is what a surface switches on; this is what it words the reason with.
///
/// **`folder not found` is deliberately absent.** A missing folder is project integrity, not a
/// connection — the project is disabled whole and repaired by relocating it, and nothing about a
/// provider changed. Admitting it here would give one repair two vocabularies.
public enum ConnectionCause: String, Equatable, Sendable, CaseIterable, Codable {
    /// This Mac has no network. Nothing was asked, so nothing was refused.
    case offline
    /// The provider was asked and did not answer — down, or the scope no longer resolves.
    case unreachable
    /// The provider answered, with a limit rather than data.
    case rateLimited
}
