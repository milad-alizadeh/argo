import ArgoEngine

extension TicketsRoomProjection {
    /// The ticket the trailing pane is open on, and everything the pane draws about it.
    ///
    /// `Detail` and not `Ticket`, which the engine's entity now owns (#881), and not `Row`, which
    /// the backlog's rows already are: this is what ONE pane draws, and the pane is the detail.
    package struct Detail: Sendable, Equatable, Identifiable {
        package let id: Int
        let title: String
        /// The provider's own status word, rendered verbatim (#272).
        let status: String
        /// What Argo files that word under. Beside it rather than instead of it: neither does the
        /// other's job.
        let bucket: TicketState
        /// The live Session(s) on this ticket, off the same `TicketClaims` value the backlog row's
        /// mark reads (#1092). Empty on every ticket `bucket` is not `.claimed` for.
        package let claimants: [TicketClaims.Claimant]
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
        package let children: Children?
        /// The blockers, in the provider's own edge order. EMPTY draws no section at all: nothing
        /// tells "no edges read" from "edges read, none found", so degrade-down takes the quieter
        /// reading (`CONTEXT.md` L2 · Honesty tier).
        package let blockedBy: [Link]
        /// The body, absent where nothing was read for it.
        let body: String?
    }

    /// One ticket named from inside another — a child, or a blocker. One shape: the two differ
    /// only in the trailing fact they carry (#815).
    package struct Link: Sendable, Equatable, Identifiable {
        package let id: Int
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
    package struct Children: Sendable, Equatable {
        package let open: [Link]
        let closed: Int
        let total: Int
    }

    /// The detail the deck is open on, derived on EVERY pass from the live selection — the one
    /// thing about the room the selected number is an input to, and so the one thing
    /// `TicketsRoomMemo` does not remember. Every ticket it names is reached through the listing's
    /// index, so opening one costs the shape of that ticket rather than the size of the backlog.
    @MainActor
    static func ticket(_ showing: Int?, in listing: TicketsListing) -> Detail? {
        guard let number = showing, let item = listing.item(number) else { return nil }
        // Read once and used twice, which is what keeps the head's two halves from disagreeing:
        // the bucket already lets closure outrank the claim (`TicketState.init`), so the
        // claimants have to answer to the bucket rather than to the claim set beneath it (#1191).
        let bucket = item.state(claimed: listing.isClaimed(number))
        return Detail(
            id: number,
            title: item.title,
            status: item.status,
            bucket: bucket,
            claimants: bucket == .claimed ? listing.claimants(of: number) : [],
            priority: item.priority,
            type: item.type,
            labels: item.labels,
            deliveries: listing.deliveries(of: number),
            children: children(of: item, in: listing),
            blockedBy: item.blockedBy?.map { blocker($0.number, in: listing) } ?? [],
            body: item.body,
        )
    }

    /// The open children in the PARENT's own order. A parent whose children are all closed keeps
    /// the section.
    @MainActor
    private static func children(of item: Ticket, in listing: TicketsListing) -> Children? {
        guard !item.children.isEmpty else { return nil }
        let known = item.children.compactMap { listing.item($0) }
        return Children(
            open: known.filter { $0.closure == .open }
                .map { child($0, delivery: listing.delivery(of: $0.number)) },
            closed: known.count { $0.closure != .open },
            total: item.children.count,
        )
    }

    /// A child, with the provider's own status word trailing it.
    private static func child(_ item: Ticket, delivery: DeliveryReading) -> Link {
        Link(id: item.number, title: item.title, delivery: delivery, trailing: item.status)
    }

    /// A blocker, named from whatever the poll reached — never a stand-in.
    @MainActor
    private static func blocker(_ number: Int, in listing: TicketsListing) -> Link {
        Link(id: number, title: listing.item(number)?.title, delivery: .absent, trailing: nil)
    }
}
