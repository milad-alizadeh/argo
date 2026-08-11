/// The Session's standing autonomy stance — a ladder whose rungs are boundaries, not prompt
/// frequencies: inside a rung the agent acts, at its edge a Permission fires (ADR-0025).
///
/// The one composer setting that must be readable without opening anything, which is why it sits
/// on the footer and never in a popover (design decision 1). Today the choice is the composer's
/// own state; #545 is where a stance starts reaching the Session it names.
enum ComposerMode: String, CaseIterable, Identifiable {
    /// No writes at all.
    case readOnly = "Read Only"
    /// Read Only's boundary carrying a deliverable. It shares a permission level with `readOnly`
    /// and differs by intent — the ladder's one deliberate pair, not a duplicate to collapse.
    case plan = "Plan"
    /// Writes and runs inside the Workspace, and asks to leave it.
    case code = "Code"
    /// No boundary, and nothing left to ask.
    case auto = "Auto"

    var id: Self {
        self
    }
}
