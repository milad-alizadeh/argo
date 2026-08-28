import Foundation

/// Filing one new ticket, end to end: resolve the Project's Binding, pick the adapter that speaks
/// its provider, write, and answer with the refusal that stopped it (#872).
///
/// **Nothing here retries** — a re-sent create files the ticket twice (`WorkItemWriter`), so the
/// answer is the outcome and pressing the control again is the only retry there is.
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

    /// The refusal, and `nil` where the ticket was filed. The ticket itself is not answered with:
    /// `WorkItemWriter` has already adopted the provider's own copy into the ledger the room draws
    /// from, and a second copy in the caller's hand could only disagree with it.
    public func create(
        _ draft: WorkItemDraft, forProject projectID: String?,
    ) async
        -> WorkItemWriteError? {
        guard let projectID,
              case let .ready(binding) = await bindings.resolve(
                  port: .workItem, for: projectID,
              )
        // A port bound to nothing has nowhere to land, which is what `unreachable` means.
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
