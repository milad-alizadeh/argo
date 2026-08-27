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
    /// The call-to-action, which belongs to no ticket — it makes one.
    var creating: () -> Void = {}
    /// The open ticket's own.
    var verbs = Verbs()

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
