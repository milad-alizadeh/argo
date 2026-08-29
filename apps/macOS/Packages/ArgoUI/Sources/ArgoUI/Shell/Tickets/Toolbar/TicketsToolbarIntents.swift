import ArgoEngine

/// What the Tickets room's toolbar controls DO, grouped by the thing each acts on.
///
/// Inert by default, for a `#Preview` and a specimen; the shell passes the live ones (#872). The
/// room reads live end to end since #820, and every verb here addresses that reading: New ticket
/// writes through `TicketWriter`, `Start` spawns a Session seeded with the open ticket, and the
/// two link verbs open the address `TicketAddress` derives from the Binding.
///
/// One value rather than four closures, because the cap is three parameters and these travel
/// together anyway. Every slot is assigned in `ticketsIntents`; a slot nothing assigns is what let
/// the funnel draw live and do nothing (#900).
struct TicketsToolbarIntents {
    /// The call-to-action, which belongs to no ticket — it makes one, through a provider. So it is
    /// this room's one provider-port write control, and the verb travels with what the control
    /// renders (#275).
    var creation = Creation()
    /// The open ticket's own.
    var verbs = Verbs()

    /// A write verb, what its control renders, and the repair the disabled reading points at.
    struct Creation {
        var act: () -> Void = {}
        var control = WriteControlState.live
        var reconnect: () -> Void = {}
    }

    struct Verbs {
        var start: () -> Void = {}
        /// Which command `Start` will send, drawn beside the word so the press can be aimed (#899),
        /// and `nil` where the ticket asks for none — an empty composer, said as `Start` alone.
        var command: WorkCommand?
        /// The two link verbs, and `nil` where this Binding cannot address the ticket in a browser
        /// at all — a Linear team id names no page (`TicketAddress`). Optional rather than an
        /// empty closure, because a control that draws live and does nothing is the thing #872 is
        /// about: absent behaviour has to reach the control as absence, so it can disable.
        var openOnHost: (() -> Void)?
        var copyLink: (() -> Void)?

        /// Verbs with nothing behind them, for a preview and for a room whose ticket has no link
        /// to open.
        @MainActor static let inert = Verbs()
    }

    /// A toolbar whose controls perform nothing, for a `#Preview` and a specimen. Not a state the
    /// app ships: `ticketsIntents` assigns every slot.
    @MainActor static let inert = TicketsToolbarIntents()
}
