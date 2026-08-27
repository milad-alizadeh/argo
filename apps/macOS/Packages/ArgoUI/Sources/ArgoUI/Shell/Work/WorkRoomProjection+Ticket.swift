import ArgoEngine

extension WorkRoomProjection {
    /// The ticket the trailing pane is open on, and everything the pane draws about it.
    struct Ticket: Sendable, Equatable, Identifiable {
        let id: Int
        let title: String
        /// The provider's own status word, rendered verbatim (#272).
        let status: String
        /// What Argo files that word under. Beside it rather than instead of it: neither does the
        /// other's job.
        let bucket: WorkItemState
        /// The provider's own priority word, absent where nothing was read.
        let priority: String?
        /// The provider's own type word, absent on the same terms.
        let type: String?
        /// The provider's labels, verbatim and COMPLETE — the ones the two facts above restate
        /// included, because a list that quietly drops its own members is not the provider's list.
        let labels: [String]
        /// The Deliveries in flight, one chip each.
        let deliveries: [DeliveryFacts]
        /// The Children section, and `nil` on a ticket the tracker gives no children — which is
        /// the section being ABSENT rather than empty.
        let children: Children?
        /// The blockers, in the provider's own edge order.
        ///
        /// EMPTY is the section absent, never an empty section: a provider that exposes no
        /// dependency information has not told us there are no blockers, and Argo cannot tell the
        /// two apart from an empty list. Degrade-down (`CONTEXT.md` L2 · Honesty tier) resolves
        /// that ambiguity to the quieter reading — say nothing rather than assert `Nothing`.
        let blockedBy: [Link]
        /// The body, absent where nothing was read for it.
        let body: String?
    }

    /// One ticket NAMED from inside another ticket — a child, or a blocker. One shape, because the
    /// two differ only in the trailing fact they carry (#815).
    struct Link: Sendable, Equatable, Identifiable {
        let id: Int
        /// The tracker's own name for it, and `nil` only where nothing was read. A blocker that is
        /// already CLOSED still has one, so the list names it rather than falling back on a
        /// placeholder that would read as the ticket's actual title.
        let title: String?
        /// A child carries its own Delivery mark. A blocker does not — nothing reads a Delivery for
        /// a ticket that is not in the backlog — so it takes `absent`, which says exactly that.
        let delivery: DeliveryReading
        /// The provider's status word on a child; absent on a blocker, whose section heading
        /// already carries the only figure there is.
        let trailing: String?
    }

    /// A parent's Children section: the open children it lists, and the tracker's own figure over
    /// all of them.
    ///
    /// The figure counts children the section does not draw, which is why `2 of 9 closed` can stand
    /// over five rows and be right.
    struct Children: Sendable, Equatable {
        let open: [Link]
        let closed: Int
        let total: Int
    }

    static func ticket(in reading: WorkReading) -> Ticket? {
        guard let number = reading.showing,
              let item = reading.items.first(where: { $0.number == number })
        else { return nil }
        return Ticket(
            id: number,
            title: item.title,
            status: item.status,
            bucket: item.state(claimed: reading.claimed.contains(number)),
            priority: reading.priorities[number],
            type: reading.types[number],
            labels: item.labels,
            deliveries: reading.deliveryFacts[number] ?? [],
            children: children(of: item, in: reading),
            blockedBy: item.blockedBy.map { blocker($0.number, in: reading) },
            body: reading.bodies[number],
        )
    }

    /// The open children in the PARENT's own order, and the closed-of-total figure over every child
    /// the tracker holds. A parent whose children are all closed still gets the section: the figure
    /// is the news there.
    private static func children(of item: WorkItem, in reading: WorkReading) -> Children? {
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

    /// A child, with the provider's own status word trailing it and its own Delivery mark.
    private static func child(_ item: WorkItem, delivery: DeliveryReading) -> Link {
        Link(id: item.number, title: item.title, delivery: delivery, trailing: item.status)
    }

    /// A blocker, named from whatever the poll reached — the tracker's own title or nothing, never
    /// a stand-in a reader cannot tell from a real one. It carries no mark: nothing reads a
    /// Delivery for a ticket that is not in the backlog, and `absent` says exactly that.
    private static func blocker(_ number: Int, in reading: WorkReading) -> Link {
        Link(
            id: number,
            title: reading.items.first { $0.number == number }?.title,
            delivery: .absent,
            trailing: nil,
        )
    }
}
