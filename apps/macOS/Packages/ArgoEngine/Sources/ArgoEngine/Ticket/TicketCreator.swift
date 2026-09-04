import Foundation

/// Filing one new ticket, and applying one intent to a ticket that already exists (#1333) — both
/// end to end: resolve the Project's Binding, pick the adapter that speaks its provider, write, and
/// answer with the refusal that stopped it (#872).
///
/// **Nothing here retries** — a re-sent create files the ticket twice, and a re-sent `close` or
/// `reopen` risks double-applying against a provider whose transition legality is per-workflow
/// (`TicketWriter`) — so the answer is the outcome and pressing the control again is the only retry
/// there is.
public struct TicketCreator: Sendable {
    private let bindings: ProjectBindings
    private let items: TicketLedger
    private let health: ConnectionHealthLedger
    private let writes: ProviderTicketWrites

    public init(
        bindings: ProjectBindings,
        items: TicketLedger,
        health: ConnectionHealthLedger,
        writes: ProviderTicketWrites = ProviderTicketWrites(),
    ) {
        self.bindings = bindings
        self.items = items
        self.health = health
        self.writes = writes
    }

    /// The refusal, and `nil` where the ticket was filed. The ticket itself is not answered with:
    /// `TicketWriter` has already adopted the provider's own copy into the ledger the room draws
    /// from, and a second copy in the caller's hand could only disagree with it.
    public func create(
        _ draft: TicketDraft, forProject projectID: String?,
    ) async
        -> TicketWriteError? {
        guard let projectID,
              case let .ready(binding) = await bindings.resolve(
                  port: .ticket, for: projectID,
              )
        // A port bound to nothing has nowhere to land, which is what `unreachable` means.
        else { return .unreachable(.unreachable) }
        let writer = writes.writer(for: binding, items: items, health: health)
        do {
            _ = try await writer.create(
                draft, on: PortReadTarget(binding: binding, projectID: projectID),
            )
            return nil
        } catch let refusal as TicketWriteError {
            return refusal
        } catch {
            // The writer converts every error to the port's own vocabulary, so this is unreachable
            // — and stated rather than force-unwrapped, because `throws` carries no proof of that.
            return .unreachable(.unreachable)
        }
    }

    /// The refusal, and `nil` where the write landed — on the same terms as `create` above, for a
    /// ticket that already exists.
    public func apply(
        _ intent: TicketIntent, to number: Int, forProject projectID: String?,
    ) async
        -> TicketWriteError? {
        guard let projectID,
              case let .ready(binding) = await bindings.resolve(port: .ticket, for: projectID)
        else { return .unreachable(.unreachable) }
        let writer = writes.writer(for: binding, items: items, health: health)
        do {
            let written = try await writer.apply(
                intent, to: number, on: PortReadTarget(binding: binding, projectID: projectID),
            )
            // `TicketWriter` adopts a ticket that just closed by dropping it from the listing it
            // left — right for a poll's own writes (`TicketAdoptionTests`), because the listing
            // holds the open ones and the very next poll would take it out anyway. A closure write
            // pressed from the pane the reader is standing ON needs the survival a followed link
            // gets past its own close (#895), or the room goes blank under them until a second
            // read brings the ticket back — so it is followed here, at the act's own end, rather
            // than in the write primitive every intent shares.
            if intent.write == .closure {
                await items.follow(written, for: projectID)
            }
            return nil
        } catch let refusal as TicketWriteError {
            return refusal
        } catch {
            return .unreachable(.unreachable)
        }
    }
}
