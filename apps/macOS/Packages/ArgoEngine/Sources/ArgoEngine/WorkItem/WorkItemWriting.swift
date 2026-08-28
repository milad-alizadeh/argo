import Foundation

/// The write half of the Work Item provider port (`CONTEXT.md` → Ports, #167).
///
/// **Pessimistic at the seam.** Every method answers with the ticket as the PROVIDER now holds it,
/// never with the ticket the caller hoped for — painting a state before the provider has said it
/// would be a false DIRECT.
public protocol WorkItemWriting: Sendable {
    /// What this adapter can be asked for, read to decide whether a control exists at all.
    var surface: WorkItemSurface { get }

    /// File a new ticket. Separate from `apply` because it has no ticket to be applied to.
    func create(_ draft: WorkItemDraft, through binding: ResolvedBinding) async throws -> WorkItem

    /// Apply one intent to one ticket, and answer with what the provider holds afterwards.
    func apply(
        _ intent: WorkItemIntent, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> WorkItem
}
