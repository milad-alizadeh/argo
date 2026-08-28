import Foundation

/// The seam a POLL reads a listing through: one resolved Binding in, its Work Items out.
///
/// A second protocol beside `WorkItemPort` rather than a widening of it, because the two questions
/// differ in exactly the fact that matters. An adapter answers for ONE provider and takes the
/// scope and grant it is handed; a poll holds a whole Binding and has to decide which adapter that
/// is. Keeping them apart is what stops a GitHub adapter from being handed a Linear token — the
/// one outcome worth ruling out at the type level (#371).
public protocol WorkItemReading: Sendable {
    func list(through binding: ResolvedBinding) async throws -> [WorkItem]
}
