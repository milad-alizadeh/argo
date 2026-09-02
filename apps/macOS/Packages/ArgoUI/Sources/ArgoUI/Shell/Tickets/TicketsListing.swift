import ArgoEngine

/// The reading with its Tickets indexed by number — the one door to a ticket the reader is not
/// already holding, and the reason answering WHICH ticket is open costs a lookup rather than a walk
/// of the listing (ADR-0028 Rule 1).
///
/// Its own file, and its listing `private`, for `HeldEvents`' reason (ADR-0028, #1070): the detail
/// is derived on every body pass, and a `first(where:)` over the items beside it would compile,
/// walk every ticket, and leave the count that gates this reading zero. Swift's `private` is
/// FILE-scoped, so the door is only a door while nothing else is written in here.
///
/// Held by `TicketsRoomMemo` beside the room it indexes, so it is built once per listing rather
/// than once per selection — the index is a function of the same stamp the room is.
@MainActor
struct TicketsListing {
    /// The reading the index was built over, selection and all. Nothing outside reads it: what the
    /// detail needs of it is asked for by number below.
    private let reading: TicketsReading
    /// The provider's items by their own number. The FIRST item of a repeated number wins, which is
    /// what `first(where:)` answered before the index and is the same answer a second poll gives.
    private let byNumber: [Int: Ticket]

    init(of reading: TicketsReading) {
        self.reading = reading
        self.byNumber = Dictionary(reading.items.map { ($0.number, $0) }) { first, _ in first }
    }

    /// The ticket that number names, at one lookup. Every look the detail takes goes through here,
    /// which is what makes `TicketsRoomTally.looks` a count of the work rather than of the answer.
    func item(_ number: Int) -> Ticket? {
        TicketsRoomTally.looked()
        return byNumber[number]
    }

    /// Whether a Session has taken this ticket — the roster join, by number.
    func isClaimed(_ number: Int) -> Bool {
        reading.claims.numbers.contains(number)
    }

    /// The one mark a Delivery spends on a ticket, `absent` where nothing was read (#258).
    func delivery(of number: Int) -> DeliveryReading {
        reading.deliveries[number] ?? .absent
    }

    /// The Deliveries in flight on this ticket, in the code host's order.
    func deliveries(of number: Int) -> [DeliveryFacts] {
        reading.deliveryFacts[number] ?? []
    }
}
