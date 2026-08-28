/// What the Work room's toolbar controls DO, grouped by the thing each acts on.
///
/// Inert by default, for a `#Preview` and a specimen; the shell passes the live ones (#872). The
/// room reads live end to end since #820, and every verb here addresses that reading: New ticket
/// writes through `WorkItemWriter`, `Start` spawns a Session seeded with the open ticket, and the
/// two link verbs open the address `WorkItemAddress` derives from the Binding.
///
/// One value rather than five closures, because the cap is three parameters and these travel
/// together anyway.
struct WorkToolbarIntents {
    /// The list's own: narrow it, and re-group what is left.
    var narrowing: () -> Void = {}
    var grouping: () -> Void = {}
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
        /// The two link verbs, and `nil` where this Binding cannot address the ticket in a browser
        /// at all — a Linear team id names no page (`WorkItemAddress`). Optional rather than an
        /// empty closure, because a control that draws live and does nothing is the thing #872 is
        /// about: absent behaviour has to reach the control as absence, so it can disable.
        var openOnHost: (() -> Void)?
        var copyLink: (() -> Void)?

        /// Verbs with nothing behind them, for a preview and for a room whose ticket has no link
        /// to open.
        @MainActor static let inert = Verbs()
    }

    /// A toolbar that draws every control and performs none, for a `#Preview` and a specimen.
    @MainActor static let inert = WorkToolbarIntents()
}
