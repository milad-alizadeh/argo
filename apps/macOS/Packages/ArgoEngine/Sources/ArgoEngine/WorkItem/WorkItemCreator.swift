import Foundation

/// Filing one new ticket, end to end: resolve the Project's Binding, pick the adapter that speaks
/// its provider, write, and answer with the refusal that stopped it (#872).
///
/// One type rather than four steps at the call site, and in the engine rather than the app for the
/// reason ADR-0022 gives: it is a derivation over values, and a derivation in the app target is one
/// no test can reach.
///
/// **Nothing here retries.** `WorkItemWriter` says why — a re-sent create files the ticket twice —
/// so the answer is the outcome, and pressing the control again is the only retry there is.
public struct WorkItemCreator: Sendable {
    private let bindings: ProjectBindings
    private let items: WorkItemLedger
    private let health: ConnectionHealthLedger
    private let writes: ProviderWorkItemWrites

    public init(
        bindings: ProjectBindings,
        items: WorkItemLedger,
        health: ConnectionHealthLedger,
        writes: ProviderWorkItemWrites = ProviderWorkItemWrites(),
    ) {
        self.bindings = bindings
        self.items = items
        self.health = health
        self.writes = writes
    }

    /// The refusal, and `nil` where the ticket was filed. The written ticket itself is not answered
    /// with: `WorkItemWriter` has already adopted the provider's own copy into the ledger the room
    /// draws from, and a second copy in the caller's hand could only disagree with it.
    ///
    /// A Project with no Work Item Binding is `unreachable` rather than a case of its own. It is
    /// not reachable from the room — the control is drawn off the same resolve — and a write with
    /// nowhere to land is exactly what that word means.
    public func create(
        _ draft: WorkItemDraft, forProject projectID: String?,
    ) async
        -> WorkItemWriteError? {
        guard let projectID,
              case let .ready(binding) = await bindings.resolve(
                  port: .workItem, for: projectID,
              )
        else { return .unreachable(.unreachable) }
        let writer = writes.writer(for: binding, items: items, health: health)
        do {
            _ = try await writer.create(
                draft, on: PortReadTarget(binding: binding, projectID: projectID),
            )
            return nil
        } catch let refusal as WorkItemWriteError {
            return refusal
        } catch {
            // The writer converts every error to the port's own vocabulary, so this is unreachable
            // — and stated rather than force-unwrapped, because `throws` carries no proof of that.
            return .unreachable(.unreachable)
        }
    }
}
