import ArgoEngine

extension TicketsRoomProjection {
    /// The ticket the trailing pane is open on, and everything the pane draws about it.
    ///
    /// `Detail` and not `Ticket`, which the engine's entity now owns (#881), and not `Row`, which
    /// the backlog's rows already are: this is what ONE pane draws, and the pane is the detail.
    struct Detail: Sendable, Equatable, Identifiable {
        let id: Int
        let title: String
        /// The provider's own status word, rendered verbatim (#272).
        let status: String
        /// What Argo files that word under. Beside it rather than instead of it: neither does the
        /// other's job.
        let bucket: TicketState
        /// The provider's own priority word, absent where nothing was read.
        let priority: String?
        /// The provider's own type word, absent on the same terms.
        let type: String?
        /// The provider's labels, verbatim and complete — the ones `priority` and `type` restate
        /// included.
        let labels: [TicketLabel]
        /// The Deliveries in flight, one chip each.
        let deliveries: [DeliveryFacts]
        /// `nil` on a ticket the tracker gives no children: the section is then absent.
        let children: Children?
        /// The blockers, in the provider's own edge order. EMPTY draws no section at all: nothing
        /// tells "no edges read" from "edges read, none found", so degrade-down takes the quieter
        /// reading (`CONTEXT.md` L2 · Honesty tier).
        let blockedBy: [Link]
        /// The body, absent where nothing was read for it.
        let body: String?
    }

    /// One ticket named from inside another — a child, or a blocker. One shape: the two differ
    /// only in the trailing fact they carry (#815).
    struct Link: Sendable, Equatable, Identifiable {
        let id: Int
        /// The tracker's own name, and `nil` only where nothing was read — a blocker already
        /// CLOSED still has one.
        let title: String?
        /// `absent` on a blocker: nothing reads a Delivery for a ticket outside the backlog.
        let delivery: DeliveryReading
        /// The provider's status word on a child; absent on a blocker.
        let trailing: String?
    }

    /// A parent's Children section. `closed` and `total` are the TRACKER's figures over children
    /// the section does not draw, which is why `2 of 9 closed` can stand over five rows and be
    /// right; children the poll never reached count in `total` alone.
    struct Children: Sendable, Equatable {
        let open: [Link]
        let closed: Int
        let total: Int
    }

    static func ticket(in reading: TicketsReading) -> Detail? {
        guard let number = reading.showing,
              let item = reading.items.first(where: { $0.number == number })
        else { return nil }
        return Detail(
            id: number,
            title: item.title,
            status: item.status,
            bucket: item.state(claimed: reading.claimed.contains(number)),
            priority: item.priority,
            type: item.type,
            labels: item.labels,
            deliveries: reading.deliveryFacts[number] ?? [],
            children: children(of: item, in: reading),
            blockedBy: item.blockedBy?.map { blocker($0.number, in: reading) } ?? [],
            body: item.body,
        )
    }

    /// The open children in the PARENT's own order. A parent whose children are all closed keeps
    /// the section.
    private static func children(of item: Ticket, in reading: TicketsReading) -> Children? {
        guard !item.children.isEmpty else { return nil }
        let known = item.children.compactMap { number in
            reading.items.first { $0.number == number }
        }
        return Children(
            open: known.filter { $0.closure == .open }
                .map { child($0, delivery: reading.deliveries[$0.number] ?? .absent) },
            closed: known.count { $0.closure != .open },
            total: item.children.count,
        )
    }

    /// A child, with the provider's own status word trailing it.
    private static func child(_ item: Ticket, delivery: DeliveryReading) -> Link {
        Link(id: item.number, title: item.title, delivery: delivery, trailing: item.status)
    }

    /// A blocker, named from whatever the poll reached — never a stand-in.
    private static func blocker(_ number: Int, in reading: TicketsReading) -> Link {
        Link(
            id: number,
            title: reading.items.first { $0.number == number }?.title,
            delivery: .absent,
            trailing: nil,
        )
    }
}
