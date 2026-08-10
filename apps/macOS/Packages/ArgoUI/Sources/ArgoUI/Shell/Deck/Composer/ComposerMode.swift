/// The Session's standing autonomy stance — how often the agent stops to ask before acting.
///
/// The one composer setting that must be readable without opening anything, which is why it sits
/// on the footer and never in a popover (design decision 1). Today the choice is the composer's
/// own state; #545 is where a stance starts reaching the Session it names.
enum ComposerMode: String, CaseIterable, Identifiable {
    case ask = "Ask"
    case plan = "Plan"
    case code = "Code"

    var id: Self {
        self
    }
}
