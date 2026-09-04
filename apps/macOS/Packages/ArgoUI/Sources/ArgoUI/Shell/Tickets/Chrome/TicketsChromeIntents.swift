import ArgoEngine

/// What the Tickets room's controls DO, grouped by the thing each acts on — and so by the pane
/// whose header draws them (#1242).
///
/// Inert by default, for a `#Preview` and a specimen; the shell passes the live ones (#872). The
/// room reads live end to end since #820, and every verb here addresses that reading: New ticket
/// writes through `TicketWriter`, and `Start` spawns a Session seeded with the open ticket — on
/// the command the resolver guessed, or on the one the reader picked instead.
///
/// **The two link verbs are gone with the window's row** (#1242). The ticket's number IS the link
/// (`TicketHead`), so a pair of vessels re-deriving one address was two more controls saying what
/// the head already says.
///
/// One value rather than four closures, because the cap is three parameters and these travel
/// together anyway. Every slot is assigned in `ticketsIntents`; a slot nothing assigns is what let
/// the funnel draw live and do nothing (#900).
package struct TicketsChromeIntents {
    /// The call-to-action, which belongs to no ticket — it makes one, through a provider. So it is
    /// this room's one provider-port write control, and the verb travels with what the control
    /// renders (#275).
    var creation = Creation()
    /// The open ticket's own.
    var verbs = Verbs()

    /// A write verb, what its control renders, and the repair the disabled reading points at.
    package struct Creation {
        var act: () -> Void = {}
        var control = WriteControlState.live
        var reconnect: () -> Void = {}

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(
            act: @escaping () -> Void = {},
            control: WriteControlState = WriteControlState.live,
            reconnect: @escaping () -> Void = {},
        ) {
            self.act = act
            self.control = control
            self.reconnect = reconnect
        }
    }

    package struct Verbs {
        var start: () -> Void = {}
        /// Which command `Start` will send, drawn beside the word so the press can be aimed (#899),
        /// and `nil` where the ticket asks for none — an empty composer, said as `Start` alone.
        var command: WorkCommand?
        /// Start on a command the reader picked in the menu instead of the resolved one — its own
        /// argument is `nil` for the fresh Session that carries the ticket and no command (#1242).
        /// One closure and not a second `start`: the two differ only in what is sent, and `start`
        /// is this one called with what `command` already says.
        ///
        /// OPTIONAL, which is the shape #872 and #900 settled for absent behaviour: the picker
        /// draws six live rows, so one left unassigned would be six controls that highlight,
        /// accept the press and do nothing. Absence has to reach the control AS absence.
        var startOn: ((WorkCommand?) -> Void)?
        /// Closing the open ticket, and its reopen twin (#1333).
        var closure = Closure()

        /// Verbs with nothing behind them, for a preview and for a room with no ticket open.
        @MainActor static let inert = Verbs()

        /// Spelled out because Swift synthesises no memberwise initializer above
        /// `internal`, and the specimens build this from their own target (#1085).
        package init(
            start: @escaping () -> Void = {},
            command: WorkCommand? = nil,
            startOn: ((WorkCommand?) -> Void)? = nil,
            closure: Closure = Closure(),
        ) {
            self.start = start
            self.command = command
            self.startOn = startOn
            self.closure = closure
        }

        /// The open ticket's closure, both directions (#1333). One value rather than two verbs on
        /// `Verbs` itself: `current` decides which of `close` and `reopen` a control may even
        /// reach, and the two travelling apart is how a room could offer both at once.
        package struct Closure {
            /// The ticket's own closure, as last adopted — `.open` draws `close`'s two reasons and
            /// anything else draws `reopen` in their place, never both — and `nil` where the
            /// Binding does not declare the `.closure` write at all.
            ///
            /// ABSENCE folded into one optional rather than a separate flag beside it (4-parameter
            /// init cap, rules/house.md): a Binding that never offers the write has no honest
            /// answer for "is this ticket open or closed" EITHER, because nothing here may draw a
            /// control that takes a press and does nothing (#872).
            var current: TicketClosure?
            /// Close with a reason. Two, not one: `TicketCloseReason` is `resolved` or `ruledOut`,
            /// and a single `Close` that always meant one of them would write a false fact every
            /// time the other was intended.
            var close: (TicketCloseReason) -> Void = { _ in }
            var reopen: () -> Void = {}
            /// What the write on the wire renders — pending disables in place, a refusal returns
            /// it pressable with the provider's own words beside it (§4).
            var control = WriteControlState.live

            /// Spelled out because Swift synthesises no memberwise initializer above
            /// `internal`, and the specimens build this from their own target (#1085).
            package init(
                current: TicketClosure? = nil,
                close: @escaping (TicketCloseReason) -> Void = { _ in },
                reopen: @escaping () -> Void = {},
                control: WriteControlState = .live,
            ) {
                self.current = current
                self.close = close
                self.reopen = reopen
                self.control = control
            }
        }
    }

    /// Controls that perform nothing, for a `#Preview` and a specimen. Not a state the app ships:
    /// `ticketsIntents` assigns every slot.
    @MainActor static let inert = TicketsChromeIntents()
}
