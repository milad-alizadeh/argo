/// What a Ticket's Delivery says, as the one mark the backlog spends on it
/// (`cockpit-work-room.md` — the delivery signal, on the dot alone). Five states on one 6pt mark
/// and no chip beside it: a row that draws its Delivery twice is a row with no room for a title.
enum DeliveryReading: Sendable, Equatable, CaseIterable {
    /// Nothing was read — a hollow ring, not a quiet fill. `absent` rather than `none` so a
    /// dictionary lookup that found nothing cannot be mistaken for a reading that says so.
    case absent
    case draft
    case open
    /// Open, with checks failing.
    case failing
    case merged
}
