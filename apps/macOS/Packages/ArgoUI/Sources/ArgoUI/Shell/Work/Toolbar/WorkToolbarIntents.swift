/// What the Work room's toolbar controls DO, grouped by the thing each acts on.
///
/// Inert by default, and passed inert by the shell for now: the room is fixture-fed end to end
/// (`CockpitView+Work.workRoom`), so there is no live ticket for a verb to address yet. #388's read
/// path supplies the Work Item link these two link verbs need, and the spawn ticket wires `start`.
/// One value rather than five closures, because the cap is three parameters and these travel
/// together anyway.
struct WorkToolbarIntents {
    /// The list's own: narrow it, and re-group what is left.
    var narrowing: () -> Void = {}
    var grouping: () -> Void = {}
    /// The call-to-action, which belongs to no ticket — it makes one, and it makes it THROUGH a
    /// provider. So it is this room's one provider-port write control, and the verb travels with
    /// what the control renders (#275).
    var creation = Creation()
    /// The open ticket's own.
    var verbs = Verbs()

    /// A write verb and its whole rendering, in one value: §7 decides whether it may be pressed
    /// and §4 what it says when it did not land, and a surface that took the closure without the
    /// state would be a button that presses into a dead connection.
    struct Creation {
        var act: () -> Void = {}
        var control = WriteControlState.live
    }

    struct Verbs {
        var start: () -> Void = {}
        var openOnHost: () -> Void = {}
        var copyLink: () -> Void = {}

        /// Verbs with nothing behind them, for a preview and for a room whose ticket has no link
        /// to open.
        @MainActor static let inert = Verbs()
    }

    /// A toolbar that draws every control and performs none, for a `#Preview` and a specimen.
    @MainActor static let inert = WorkToolbarIntents()
}
