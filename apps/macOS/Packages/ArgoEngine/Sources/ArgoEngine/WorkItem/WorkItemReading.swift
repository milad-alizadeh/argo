import Foundation

/// The seam a POLL reads a listing through: one resolved Binding in, its Work Items out.
///
/// Separate from `WorkItemPort` because an adapter is handed a scope and a grant, which do not say
/// which provider issued them — and a GitHub token sent to Linear is the one outcome worth ruling
/// out at the type level (#371).
public protocol WorkItemReading: Sendable {
    func list(through binding: ResolvedBinding) async throws -> [WorkItem]
}
